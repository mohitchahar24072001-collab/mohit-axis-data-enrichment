import { NextRequest, NextResponse } from 'next/server';
import { insertManyContacts, logActivity } from '@/lib/db';

interface ImportContact {
  first_name: string;
  last_name: string;
  email: string;
  original_company: string;
  original_title: string;
  city: string;
  country: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contacts } = body as { contacts: ImportContact[] };

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    // Validate and clean contacts
    const cleanedContacts = contacts.map((c) => ({
      first_name: String(c.first_name || '').trim(),
      last_name: String(c.last_name || '').trim(),
      email: String(c.email || '').trim().toLowerCase(),
      original_company: String(c.original_company || '').trim(),
      original_title: String(c.original_title || '').trim(),
      city: String(c.city || '').trim(),
      country: String(c.country || '').trim(),
      current_company: null,
      current_title: null,
      linkedin_url: null,
      sources: null,
      confidence_score: null,
      status: 'pending' as const,
      error_message: null,
    }));

    // Filter out completely empty rows
    const validContacts = cleanedContacts.filter(
      (c) => c.first_name || c.last_name || c.email
    );

    if (validContacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts found' }, { status: 400 });
    }

    const count = await insertManyContacts(validContacts);
    await logActivity(null, 'import_completed', `Imported ${count} contacts from CSV`);

    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count.toLocaleString()} contacts`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
