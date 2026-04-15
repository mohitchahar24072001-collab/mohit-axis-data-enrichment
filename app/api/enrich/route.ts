import { NextRequest, NextResponse } from 'next/server';
import { getPendingContacts, getContactsByIds } from '@/lib/db';
import { startEnrichmentQueue, stopEnrichmentQueue, getEnrichmentStatus } from '@/lib/enrichment';

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
    const { ids } = body as { ids: number[] | 'all' };

    let contactIds: number[];

    if (ids === 'all') {
      const contacts = await getPendingContacts(5000);
      contactIds = contacts.map((c) => c.id);
    } else if (Array.isArray(ids)) {
      // Validate ids exist
      const contacts = await getContactsByIds(ids);
      contactIds = contacts.map((c) => c.id);
    } else {
      return NextResponse.json({ error: 'Invalid ids parameter' }, { status: 400 });
    }

    if (contactIds.length === 0) {
      return NextResponse.json({ message: 'No contacts to enrich', count: 0 });
    }

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
