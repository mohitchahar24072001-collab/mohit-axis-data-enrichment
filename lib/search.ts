export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  provider: string;
}

async function googleCustomSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    throw new Error('Google Custom Search API key or Search Engine ID not configured');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Google API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  if (!data.items) {
    return [];
  }

  return data.items.map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
  }));
}

async function serpApiSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    throw new Error('SerpAPI key not configured');
  }

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  url.searchParams.set('engine', 'google');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.organic_results) {
    return [];
  }

  return data.organic_results.slice(0, 5).map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
  }));
}

export async function searchWeb(query: string): Promise<SearchResponse> {
  // Try Google Custom Search first
  const googleKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (googleKey && googleCx) {
    try {
      const results = await googleCustomSearch(query);
      return { results, query, provider: 'google' };
    } catch (error) {
      console.warn('Google Custom Search failed, trying SerpAPI fallback:', error);
    }
  }

  // Fallback to SerpAPI
  const serpKey = process.env.SERP_API_KEY;
  if (serpKey) {
    try {
      const results = await serpApiSearch(query);
      return { results, query, provider: 'serpapi' };
    } catch (error) {
      console.warn('SerpAPI also failed:', error);
    }
  }

  // No search providers available - return empty results
  console.warn('No search provider configured. Please set GOOGLE_CUSTOM_SEARCH_API_KEY or SERP_API_KEY');
  return { results: [], query, provider: 'none' };
}

export function buildSearchQueries(
  firstName: string,
  lastName: string,
  company?: string | null,
  title?: string | null
): string[] {
  const fullName = `"${firstName} ${lastName}"`;
  const queries: string[] = [];

  // Primary LinkedIn query
  if (company) {
    queries.push(`${fullName} "${company}" LinkedIn`);
    queries.push(`${fullName} site:linkedin.com`);
    queries.push(`${fullName} "${company}" current job 2024`);
  } else {
    queries.push(`${fullName} site:linkedin.com`);
    queries.push(`${fullName} LinkedIn professional`);
    if (title) {
      queries.push(`${fullName} "${title}" 2024`);
    }
  }

  return queries;
}
