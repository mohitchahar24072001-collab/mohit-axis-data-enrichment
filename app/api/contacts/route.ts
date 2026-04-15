import { NextRequest, NextResponse } from 'next/server';
import { getContacts, deleteContacts } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const result = await getContacts({ page, limit, status, search });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Contacts fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }
    const deleted = await deleteContacts(ids);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Delete contacts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete contacts' },
      { status: 500 }
    );
  }
}
