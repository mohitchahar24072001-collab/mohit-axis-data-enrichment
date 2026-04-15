import { createClient } from '@supabase/supabase-js';

// ── Supabase client ────────────────────────────────────────────────────────
// Uses SERVICE key (server-side only — never expose to browser)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

let _supabase: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
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
  const supabase = getClient();
  const { data, error } = await supabase
    .from('contacts')
    .insert(contact)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function insertManyContacts(
  items: Pick<
    Contact,
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'original_company'
    | 'original_title'
    | 'city'
    | 'country'
    | 'current_company'
    | 'current_title'
    | 'linkedin_url'
    | 'sources'
    | 'confidence_score'
    | 'status'
    | 'error_message'
  >[]
): Promise<number> {
  const supabase = getClient();
  const { error } = await supabase.from('contacts').insert(items);
  if (error) throw new Error(error.message);
  return items.length;
}

export async function getContact(id: number): Promise<Contact | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Contact;
}

export async function getContacts(query: ContactsQuery = {}): Promise<PaginatedContacts> {
  const supabase = getClient();
  const { page = 1, limit = 50, status, search } = query;
  const offset = (page - 1) * limit;

  let q = supabase.from('contacts').select('*', { count: 'exact' });

  if (status && status !== 'all') {
    q = q.eq('status', status);
  }

  if (search) {
    const s = `%${search}%`;
    q = q.or(
      `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},original_company.ilike.${s}`
    );
  }

  q = q.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    contacts: (data as Contact[]) ?? [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateContact(id: number, data: Partial<Contact>): Promise<void> {
  const supabase = getClient();
  // Remove id/created_at from update payload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, ...rest } = data as Record<string, unknown>;
  const { error } = await supabase
    .from('contacts')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getPendingContacts(limit = 100): Promise<Contact[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as Contact[]) ?? [];
}

export async function getContactsByIds(ids: number[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const supabase = getClient();
  const { data, error } = await supabase.from('contacts').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  return (data as Contact[]) ?? [];
}

export async function getAllContacts(): Promise<Contact[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Contact[]) ?? [];
}

export async function getStats(): Promise<Stats> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('get_contact_stats');
  if (error) {
    // Fallback: manual counts if RPC not available
    const { data: contacts, error: err2 } = await supabase
      .from('contacts')
      .select('status');
    if (err2) throw new Error(err2.message);
    const all = contacts ?? [];
    return {
      total: all.length,
      enriched: all.filter((c: { status: string }) => c.status === 'enriched').length,
      pending: all.filter((c: { status: string }) => c.status === 'pending').length,
      failed: all.filter((c: { status: string }) => c.status === 'failed').length,
      enriching: all.filter((c: { status: string }) => c.status === 'enriching').length,
    };
  }
  return data as Stats;
}

export async function deleteContacts(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = getClient();
  // activity_log rows cascade-delete automatically (FK ON DELETE CASCADE)
  const { error, count } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteAllContacts(): Promise<void> {
  const supabase = getClient();
  // Delete activity first (in case no cascade), then contacts
  await supabase.from('activity_log').delete().neq('id', 0);
  await supabase.from('contacts').delete().neq('id', 0);
}

// ── Activity Log ───────────────────────────────────────────────────────────

export async function logActivity(
  contactId: number | null,
  action: string,
  details?: string
): Promise<void> {
  const supabase = getClient();
  await supabase.from('activity_log').insert({
    contact_id: contactId,
    action,
    details: details ?? null,
  });
  // Trim to last 500 — Supabase handles this via a DB trigger ideally,
  // but for now we skip trimming (Supabase storage is generous on free tier)
}

export async function getRecentActivity(
  limit = 20
): Promise<(ActivityLog & { contact_name?: string })[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, contacts(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const contact = row.contacts as { first_name?: string; last_name?: string } | null;
    const name = contact
      ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contacts: _c, ...rest } = row;
    return { ...(rest as ActivityLog), contact_name: name || undefined };
  });
}
