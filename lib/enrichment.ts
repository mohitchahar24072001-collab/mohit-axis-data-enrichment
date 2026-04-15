import { GoogleGenerativeAI } from '@google/generative-ai';
import { Contact, getContact, updateContact, logActivity } from './db';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface EnrichmentResult {
  current_company: string | null;
  current_title: string | null;
  linkedin_url: string | null;
  confidence_score: number;
  reasoning: string;
  sources: string[];
}

const MIN_CONFIDENCE = 70;
const MAX_RETRIES = 3;

// Parse retry delay from Gemini 429 error messages
function getRetryDelayMs(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/retryDelay['":\s]+(\d+)s/);
  if (match) return (parseInt(match[1]) + 2) * 1000;
  return 15000; // default 15s
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let isEnriching = false;
let enrichmentQueue: number[] = [];
let currentEnrichingId: number | null = null;
let processedCount = 0;
let failedCount = 0;

export function getEnrichmentStatus() {
  return { isEnriching, queueLength: enrichmentQueue.length, currentId: currentEnrichingId, processedCount, failedCount };
}

export function startEnrichmentQueue(ids: number[]) {
  if (isEnriching) {
    enrichmentQueue.push(...ids.filter(id => !enrichmentQueue.includes(id)));
    return;
  }
  enrichmentQueue = ids;
  processedCount = 0;
  failedCount = 0;
  isEnriching = true;
  processNextInQueue();
}

export function stopEnrichmentQueue() {
  isEnriching = false;
  enrichmentQueue = [];
  currentEnrichingId = null;
}

async function processNextInQueue() {
  if (!isEnriching || enrichmentQueue.length === 0) {
    isEnriching = false;
    currentEnrichingId = null;
    return;
  }
  const id = enrichmentQueue.shift()!;
  currentEnrichingId = id;
  try {
    await enrichContact(id);
    processedCount++;
  } catch (e) {
    failedCount++;
    console.error(`Failed contact ${id}:`, e);
  }
  setTimeout(() => processNextInQueue(), 3000);
}

export async function enrichContact(contactId: number): Promise<EnrichmentResult> {
  const contact = await getContact(contactId);
  if (!contact) throw new Error(`Contact ${contactId} not found`);

  await updateContact(contactId, { status: 'enriching', error_message: null });
  await logActivity(contactId, 'enrichment_started', `Searching for ${contact.first_name} ${contact.last_name}`);

  try {
    const result = await performEnrichment(contact);

    await updateContact(contactId, {
      current_company: result.current_company,
      current_title: result.current_title,
      linkedin_url: result.linkedin_url,
      confidence_score: result.confidence_score,
      sources: JSON.stringify(result.sources),
      status: result.confidence_score > 0 ? 'enriched' : 'failed',
      error_message:
        result.confidence_score < MIN_CONFIDENCE && result.confidence_score > 0
          ? `Low confidence (${result.confidence_score}%): ${result.reasoning}`
          : result.confidence_score === 0
          ? `Not found: ${result.reasoning}`
          : null,
    });

    await logActivity(
      contactId,
      'enrichment_completed',
      `${result.confidence_score}% — ${result.current_company || '?'} / ${result.current_title || '?'}`
    );

    return result;
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Unknown error';
    // Show clean message instead of raw API error
    let msg = raw;
    if (raw.includes('429') || raw.includes('quota')) {
      msg = 'API rate limit reached. The free tier allows 20 searches/day. Try again tomorrow or enable billing at aistudio.google.com.';
    } else if (raw.includes('403')) {
      msg = 'API key not authorised. Check your GOOGLE_API_KEY in .env.local.';
    } else if (raw.includes('404')) {
      msg = 'AI model not found. Check your API key has Gemini access.';
    }
    await updateContact(contactId, { status: 'failed', error_message: msg });
    await logActivity(contactId, 'enrichment_failed', `Failed: ${msg}`);
    throw error;
  }
}

async function performEnrichment(contact: Contact): Promise<EnrichmentResult> {
  const firstName = contact.first_name?.trim() || '';
  const lastName = contact.last_name?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (!fullName) throw new Error('Contact has no name');

  const company = contact.original_company || '';
  const title = contact.original_title || '';
  const location = [contact.city, contact.country].filter(Boolean).join(', ');
  const email = contact.email || '';
  const year = new Date().getFullYear();

  // Gemini 2.5 Flash with Google Search grounding — searches live web automatically
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as never],
  });

  const prompt = `You are a professional data enrichment researcher. Search the web to find the CURRENT employment of this specific person in ${year}.

PERSON TO FIND:
- Full Name: ${fullName}
- Previously worked at: ${company || 'Unknown'}
- Previous job title: ${title || 'Unknown'}
- Email: ${email || 'Unknown'}
- Location: ${location || 'Unknown'}

SEARCH INSTRUCTIONS:
1. Search for "${fullName}" LinkedIn profile${company ? ` mentioning "${company}"` : ''}
2. Search for "${fullName}" current job ${year}
3. Check if they changed companies since working at ${company || 'their previous employer'}
4. Find their LinkedIn URL if possible

MATCHING RULES:
- Same full name + same previous company = very likely the same person (80%+ confidence)
- Same full name + same industry/location = likely the same person (70%+ confidence)
- Be generous: if you're 70% sure it's them, that's good enough
- Report where they work NOW in ${year}, not where they worked before

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "current_company": "Company Name or null",
  "current_title": "Job Title or null",
  "linkedin_url": "https://linkedin.com/in/username or null",
  "confidence_score": 85,
  "reasoning": "Found LinkedIn profile showing they moved from X to Y in 2023",
  "sources": ["https://...", "https://..."]
}`;

  // Retry with automatic backoff on rate limit (429) errors
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Extract grounding sources from metadata
      const groundingSources: string[] = [];
      try {
        const candidates = result.response.candidates || [];
        for (const candidate of candidates) {
          const meta = (candidate as { groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] } }).groundingMetadata;
          if (meta?.groundingChunks) {
            for (const chunk of meta.groundingChunks) {
              if (chunk.web?.uri) groundingSources.push(chunk.web.uri);
            }
          }
        }
      } catch { /* metadata not available */ }

      return parseJsonResult(text, groundingSources);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes('429') || msg.includes('quota');
      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = getRetryDelayMs(err);
        console.log(`Rate limited. Waiting ${delay / 1000}s then retry ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

function parseJsonResult(text: string, fallbackSources: string[]): EnrichmentResult {
  const jsonMatch = text.match(/\{[\s\S]*?\}/g);
  if (jsonMatch) {
    for (let i = jsonMatch.length - 1; i >= 0; i--) {
      try {
        const raw = JSON.parse(jsonMatch[i]);
        if ('confidence_score' in raw || 'current_company' in raw) {
          return {
            current_company: raw.current_company || null,
            current_title: raw.current_title || null,
            linkedin_url: extractLinkedInUrl(raw.linkedin_url) || extractLinkedInUrl(text),
            confidence_score: Math.max(0, Math.min(100, parseInt(raw.confidence_score) || 0)),
            reasoning: raw.reasoning || '',
            sources:
              Array.isArray(raw.sources) && raw.sources.length > 0
                ? raw.sources
                : fallbackSources,
          };
        }
      } catch {
        continue;
      }
    }
  }
  return {
    current_company: null,
    current_title: null,
    linkedin_url: extractLinkedInUrl(text),
    confidence_score: 0,
    reasoning: 'Could not parse a structured response from the search.',
    sources: fallbackSources,
  };
}

function extractLinkedInUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+\/?/);
  return match ? match[0] : null;
}
