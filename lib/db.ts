import { neon } from '@neondatabase/serverless';

// ── Neon Postgres client ───────────────────────────────────────────────────
function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  original_company: string | null;
  original_title: string | null;
  city: string | null;
  country: string | null;
  current_company: string | null;
  current_title: string | null;
  linkedin_url: string | null;
  sources: string | null;
  confidence_score: number | null;
  status: 'pending' | 'enriching' | 'enriched' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  contact_id: number | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface ContactsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface PaginatedContacts {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Stats {
  total: number;
  enriched: number;
  pending: number;
  failed: number;
  enriching: number;
}

// ── Contact CRUD ───────────────────────────────────────────────────────────

export async function insertContact(
  contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>
): Promise<number> {
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO contacts (first_name, last_name, email, original_company, original_title,
      city, country, current_company, current_title, linkedin_url, sources,
      confidence_score, status, error_message)
    VALUES (${contact.first_name}, ${contact.last_name}, ${contact.email},
      ${contact.original_company}, ${contact.original_title}, ${contact.city},
      ${contact.country}, ${contact.current_company}, ${contact.current_title},
      ${contact.linkedin_url}, ${contact.sources}, ${contact.confidence_score},
      ${contact.status}, ${contact.error_message})
    RETURNING id
  `;
  return rows[0].id;
}

export async function insertManyContacts(items: Omit<Contact, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
  if (items.length === 0) return 0;
  const sql = getSQL();
  for (const item of items) {
    await sql`
      INSERT INTO contacts (first_name, last_name, email, original_company, original_title,
        city, country, current_company, current_title, linkedin_url, sources,
        confidence_score, status, error_message)
      VALUES (${item.first_name}, ${item.last_name}, ${item.email},
        ${item.original_company}, ${item.original_title}, ${item.city}, ${item.country},
        ${item.current_company ?? null}, ${item.current_title ?? null},
        ${item.linkedin_url ?? null}, ${item.sources ?? null},
        ${item.confidence_score ?? null}, ${item.status ?? 'pending'}, ${item.error_message ?? null})
    `;
  }
  return items.length;
}

export async function getContact(id: number): Promise<Contact | null> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`;
  return (rows[0] as Contact) ?? null;
}

export async function getContacts(query: ContactsQuery = {}): Promise<PaginatedContacts> {
  const sql = getSQL();
  const { page = 1, limit = 50, status, search } = query;
  const offset = (page - 1) * limit;

  let contacts: Contact[];
  let countRows: { count: string }[];

  if (status && status !== 'all' && search) {
    const s = `%${search}%`;
    contacts = await sql`
      SELECT * FROM contacts
      WHERE status = ${status}
        AND (first_name ILIKE ${s} OR last_name ILIKE ${s} OR email ILIKE ${s} OR original_company ILIKE ${s})
      ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}
    ` as Contact[];
    countRows = await sql`
      SELECT COUNT(*)::text as count FROM contacts
      WHERE status = ${status}
        AND (first_name ILIKE ${s} OR last_name ILIKE ${s} OR email ILIKE ${s} OR original_company ILIKE ${s})
    ` as { count: string }[];
  } else if (status && status !== 'all') {
    contacts = await sql`
      SELECT * FROM contacts WHERE status = ${status}
      ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}
    ` as Contact[];
    countRows = await sql`SELECT COUNT(*)::text as count FROM contacts WHERE status = ${status}` as { count: string }[];
  } else if (search) {
    const s = `%${search}%`;
    contacts = await sql`
      SELECT * FROM contacts
      WHERE first_name ILIKE ${s} OR last_name ILIKE ${s} OR email ILIKE ${s} OR original_company ILIKE ${s}
      ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}
    ` as Contact[];
    countRows = await sql`
      SELECT COUNT(*)::text as count FROM contacts
      WHERE first_name ILIKE ${s} OR last_name ILIKE ${s} OR email ILIKE ${s} OR original_company ILIKE ${s}
    ` as { count: string }[];
  } else {
    contacts = await sql`
      SELECT * FROM contacts ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}
    ` as Contact[];
    countRows = await sql`SELECT COUNT(*)::text as count FROM contacts` as { count: string }[];
  }

  const total = parseInt(countRows[0]?.count ?? '0');
  return { contacts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateContact(id: number, data: Partial<Contact>): Promise<void> {
  const sql = getSQL();
  const d = data as Record<string, unknown>;
  await sql`
    UPDATE contacts SET
      first_name = CASE WHEN ${d.first_name !== undefined} THEN ${d.first_name as string ?? null} ELSE first_name END,
      last_name = CASE WHEN ${d.last_name !== undefined} THEN ${d.last_name as string ?? null} ELSE last_name END,
      email = CASE WHEN ${d.email !== undefined} THEN ${d.email as string ?? null} ELSE email END,
      current_company = CASE WHEN ${d.current_company !== undefined} THEN ${d.current_company as string ?? null} ELSE current_company END,
      current_title = CASE WHEN ${d.current_title !== undefined} THEN ${d.current_title as string ?? null} ELSE current_title END,
      linkedin_url = CASE WHEN ${d.linkedin_url !== undefined} THEN ${d.linkedin_url as string ?? null} ELSE linkedin_url END,
      sources = CASE WHEN ${d.sources !== undefined} THEN ${d.sources as string ?? null} ELSE sources END,
      confidence_score = CASE WHEN ${d.confidence_score !== undefined} THEN ${d.confidence_score as number ?? null} ELSE confidence_score END,
      status = CASE WHEN ${d.status !== undefined} THEN ${d.status as string ?? null} ELSE status END,
      error_message = CASE WHEN ${d.error_message !== undefined} THEN ${d.error_message as string ?? null} ELSE error_message END,
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getPendingContacts(limit = 100): Promise<Contact[]> {
  const sql = getSQL();
  return await sql`
    SELECT * FROM contacts WHERE status = 'pending'
    ORDER BY created_at ASC LIMIT ${limit}
  ` as Contact[];
}

export async function getContactsByIds(ids: number[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const sql = getSQL();
  return await sql`SELECT * FROM contacts WHERE id = ANY(${ids})` as Contact[];
}

export async function getAllContacts(): Promise<Contact[]> {
  const sql = getSQL();
  return await sql`SELECT * FROM contacts ORDER BY id ASC` as Contact[];
}

export async function getStats(): Promise<Stats> {
  const sql = getSQL();
  const rows = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'enriched')::int as enriched,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
      COUNT(*) FILTER (WHERE status = 'enriching')::int as enriching
    FROM contacts
  `;
  return rows[0] as Stats;
}

export async function deleteContacts(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const sql = getSQL();
  const rows = await sql`DELETE FROM contacts WHERE id = ANY(${ids}) RETURNING id`;
  return rows.length;
}

export async function deleteAllContacts(): Promise<void> {
  const sql = getSQL();
  await sql`DELETE FROM activity_log`;
  await sql`DELETE FROM contacts`;
}

// ── Activity Log ───────────────────────────────────────────────────────────

export async function logActivity(
  contactId: number | null,
  action: string,
  details?: string
): Promise<void> {
  const sql = getSQL();
  await sql`
    INSERT INTO activity_log (contact_id, action, details)
    VALUES (${contactId}, ${action}, ${details ?? null})
  `;
  await sql`
    DELETE FROM activity_log WHERE id NOT IN (
      SELECT id FROM activity_log ORDER BY created_at DESC LIMIT 500
    )
  `;
}

export async function getRecentActivity(
  limit = 20
): Promise<(ActivityLog & { contact_name?: string })[]> {
  const sql = getSQL();
  const rows = await sql`
    SELECT a.*,
      TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) as contact_name
    FROM activity_log a
    LEFT JOIN contacts c ON c.id = a.contact_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;
  return rows as (ActivityLog & { contact_name?: string })[];
}
