import { NextRequest, NextResponse } from 'next/server';
import { getPendingContacts, getContactsByIds, updateContact, getContacts } from '@/lib/db';
import { startEnrichmentQueue, stopEnrichmentQueue, getEnrichmentStatus, processOneContact } from '@/lib/enrichment';

export const maxDuration = 60; // Allow up to 60s on Vercel

// Reset contacts stuck in "enriching" (Vercel serverless killed mid-process)
async function resetStuckContacts() {
  const result = await getContacts({ status: 'enriching', limit: 200 });
  for (const contact of result.contacts) {
    const stuckMs = Date.now() - new Date(contact.updated_at).getTime();
    if (stuckMs > 5 * 60 * 1000) { // stuck > 5 minutes
      await updateContact(contact.id, { status: 'pending', error_message: null });
    }
  }
}

export async function GET() {
  try {
    const status = getEnrichmentStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Enrichment status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, mode } = body as { ids: number[] | 'all'; mode?: 'serverless' | 'queue' };

    // Auto-reset any stuck contacts first
    await resetStuckContacts();

    let contactIds: number[];

    if (ids === 'all') {
      const contacts = await getPendingContacts(5000);
      contactIds = contacts.map((c) => c.id);
    } else if (Array.isArray(ids)) {
      // Also reset these contacts to pending if they're stuck
      const contacts = await getContactsByIds(ids);
      contactIds = contacts.map((c) => c.id);
      // Reset any that are stuck enriching
      for (const c of contacts) {
        if (c.status === 'enriching') {
          await updateContact(c.id, { status: 'pending', error_message: null });
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid ids parameter' }, { status: 400 });
    }

    if (contactIds.length === 0) {
      return NextResponse.json({ message: 'No contacts to enrich', count: 0 });
    }

    // On Vercel serverless: process ONE contact now, return immediately
    // Frontend will keep calling this until all done
    if (mode === 'serverless' || process.env.VERCEL) {
      const result = await processOneContact(contactIds[0]);
      return NextResponse.json({
        success: true,
        processed: result.contactId,
        remaining: contactIds.length - 1,
        total: contactIds.length,
        done: contactIds.length <= 1,
      });
    }

    // Local dev: use background queue
    startEnrichmentQueue(contactIds);
    return NextResponse.json({
      success: true,
      message: `Started enrichment for ${contactIds.length} contacts`,
      count: contactIds.length,
    });
  } catch (error) {
    console.error('Start enrichment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start enrichment' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    stopEnrichmentQueue();
    return NextResponse.json({ success: true, message: 'Enrichment stopped' });
  } catch (error) {
    console.error('Stop enrichment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop enrichment' },
      { status: 500 }
    );
  }
}
