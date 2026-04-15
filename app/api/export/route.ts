import { NextResponse } from 'next/server';
import { getAllContacts } from '@/lib/db';

function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const contacts = await getAllContacts();

    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Email',
      'Original Company',
      'Original Title',
      'City',
      'Country',
      'Current Company',
      'Current Title',
      'LinkedIn URL',
      'Confidence Score',
      'Status',
      'Created At',
      'Updated At',
    ];

    const rows = contacts.map((c) => [
      c.id,
      escapeCSVField(c.first_name),
      escapeCSVField(c.last_name),
      escapeCSVField(c.email),
      escapeCSVField(c.original_company),
      escapeCSVField(c.original_title),
      escapeCSVField(c.city),
      escapeCSVField(c.country),
      escapeCSVField(c.current_company),
      escapeCSVField(c.current_title),
      escapeCSVField(c.linkedin_url),
      c.confidence_score !== null ? c.confidence_score : '',
      escapeCSVField(c.status),
      escapeCSVField(c.created_at),
      escapeCSVField(c.updated_at),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const filename = `contacts-enriched-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
