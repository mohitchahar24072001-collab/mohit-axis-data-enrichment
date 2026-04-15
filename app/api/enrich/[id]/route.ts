import { NextRequest, NextResponse } from 'next/server';
import { getContact } from '@/lib/db';
import { enrichContact } from '@/lib/enrichment';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    const contact = getContact(id);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const result = await enrichContact(id);
    const updated = getContact(id);
    return NextResponse.json({ success: true, contact: updated, enrichment: result });
  } catch (error) {
    console.error(`Enrich contact error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    );
  }
}
