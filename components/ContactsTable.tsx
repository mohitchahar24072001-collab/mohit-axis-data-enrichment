'use client';

import Link from 'next/link';
import StatusBadge from './StatusBadge';

interface Contact {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  original_company: string | null;
  original_title: string | null;
  current_company: string | null;
  current_title: string | null;
  confidence_score: number | null;
  status: 'pending' | 'enriching' | 'enriched' | 'failed';
  updated_at: string;
}

interface ContactsTableProps {
  contacts: Contact[];
  selectedIds: number[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: number, checked: boolean) => void;
  onEnrichSelected: () => void;
  isEnriching: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-sm">-</span>;

  let colorClass = 'text-red-600 bg-red-50';
  if (score >= 80) colorClass = 'text-green-700 bg-green-50';
  else if (score >= 60) colorClass = 'text-yellow-700 bg-yellow-50';
  else if (score >= 40) colorClass = 'text-orange-700 bg-orange-50';

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
      {score}%
    </span>
  );
}

export default function ContactsTable({
  contacts,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onEnrichSelected,
  isEnriching,
}: ContactsTableProps) {
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.includes(c.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Table toolbar */}
      {selectedIds.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">
            {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onEnrichSelected}
            disabled={isEnriching}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEnriching ? 'Enriching...' : 'Enrich Selected'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Original Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Current Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Current Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm font-medium">No contacts found</p>
                    <p className="text-xs">Import a CSV file to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedIds.includes(contact.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(contact.id)}
                      onChange={(e) => onSelectOne(contact.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {contact.email || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      <div className="font-medium">{contact.original_company || '—'}</div>
                      {contact.original_title && (
                        <div className="text-xs text-gray-400">{contact.original_title}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {contact.current_company ? (
                      <span className="text-gray-900 font-medium">{contact.current_company}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {contact.current_title ? (
                      <span className="text-gray-700">{contact.current_title}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={contact.confidence_score} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={contact.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDate(contact.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
