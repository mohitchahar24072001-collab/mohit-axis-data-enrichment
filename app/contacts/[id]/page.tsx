'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

interface Contact {
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

function ConfidenceMeter({ score }: { score: number | null }) {
  if (score === null) return null;

  let color = 'bg-red-500';
  let label = 'Very Low';
  if (score >= 80) { color = 'bg-green-500'; label = 'High'; }
  else if (score >= 60) { color = 'bg-yellow-500'; label = 'Medium'; }
  else if (score >= 40) { color = 'bg-orange-500'; label = 'Low'; }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Confidence Score</span>
        <span className="font-semibold">{score}% — {label}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function DataRow({ label, original, enriched, isLink }: {
  label: string;
  original?: string | null;
  enriched?: string | null;
  isLink?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="text-sm text-gray-700">
        {original || <span className="text-gray-300 italic">Not provided</span>}
      </div>
      <div className="text-sm">
        {enriched ? (
          isLink ? (
            <a
              href={enriched}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {enriched}
            </a>
          ) : (
            <span className="text-gray-900 font-medium">{enriched}</span>
          )
        ) : (
          <span className="text-gray-300 italic">Not found</span>
        )}
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState({
    current_company: '',
    current_title: '',
    linkedin_url: '',
  });
  const [sources, setSources] = useState<string[]>([]);

  const fetchContact = async () => {
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContact(data.contact);
        try {
          setSources(JSON.parse(data.contact.sources || '[]'));
        } catch {
          setSources([]);
        }
        setOverrides({
          current_company: data.contact.current_company || '',
          current_title: data.contact.current_title || '',
          linkedin_url: data.contact.linkedin_url || '',
        });
      } else if (res.status === 404) {
        router.push('/contacts');
      }
    } catch (error) {
      console.error('Failed to fetch contact:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContact();
  }, [id]);

  // Poll while enriching
  useEffect(() => {
    if (contact?.status === 'enriching') {
      const interval = setInterval(fetchContact, 2000);
      return () => clearInterval(interval);
    }
  }, [contact?.status]);

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: 'POST' });
      if (res.ok) {
        await fetchContact();
      }
    } catch (error) {
      console.error('Failed to enrich contact:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSaveOverrides = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...overrides,
          status: 'enriched',
        }),
      });
      if (res.ok) {
        await fetchContact();
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to save overrides:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) return null;

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown Contact';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/contacts" className="hover:text-gray-900">Contacts</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">{fullName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
            {(contact.first_name?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{contact.email || 'No email'}</p>
            <div className="mt-2">
              <StatusBadge status={contact.status} size="md" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEnrich}
            disabled={isEnriching || contact.status === 'enriching'}
            className="btn-primary flex items-center gap-2"
          >
            {isEnriching || contact.status === 'enriching' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enriching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-Enrich
              </>
            )}
          </button>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manual Override
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSaveOverrides} disabled={isSaving} className="btn-primary text-sm">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {contact.status === 'failed' && contact.error_message && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Enrichment failed</p>
              <p className="text-sm text-red-600 mt-1">{contact.error_message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Data Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original vs Enriched */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original Data</div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  {editMode ? 'Override Value' : 'Enriched Data'}
                </div>
              </div>
            </div>
            <div className="px-6">
              <DataRow label="Company" original={contact.original_company} enriched={contact.current_company} />
              <DataRow label="Job Title" original={contact.original_title} enriched={contact.current_title} />
              <DataRow label="City" original={contact.city} enriched={null} />
              <DataRow label="Country" original={contact.country} enriched={null} />
            </div>
          </div>

          {/* Override fields */}
          {editMode && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Manual Override</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Company</label>
                  <input
                    type="text"
                    value={overrides.current_company}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, current_company: e.target.value }))}
                    className="input"
                    placeholder="Enter current company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Title</label>
                  <input
                    type="text"
                    value={overrides.current_title}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, current_title: e.target.value }))}
                    className="input"
                    placeholder="Enter current job title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={overrides.linkedin_url}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, linkedin_url: e.target.value }))}
                    className="input"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Sources Used</h3>
              <div className="space-y-2">
                {sources.slice(0, 10).map((source, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 break-all line-clamp-1"
                    >
                      {source}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Confidence */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Enrichment Quality</h3>
            <ConfidenceMeter score={contact.confidence_score} />
            {contact.linkedin_url && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">LinkedIn Profile</p>
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  View Profile
                </a>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Details</h3>
            <div className="space-y-3">
              {contact.email && (
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:text-blue-800">
                    {contact.email}
                  </a>
                </div>
              )}
              {(contact.city || contact.country) && (
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm text-gray-700">
                    {[contact.city, contact.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Record Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm text-gray-700">
                  {new Date(contact.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Updated</p>
                <p className="text-sm text-gray-700">
                  {new Date(contact.updated_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Contact ID</p>
                <p className="text-sm text-gray-700 font-mono">#{contact.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
