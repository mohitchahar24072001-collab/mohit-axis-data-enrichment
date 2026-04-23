'use client';

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

type Tab = 'csv' | 'manual';

type ColumnMapping = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  city: string;
  country: string;
};

const REQUIRED_FIELDS = ['firstName', 'lastName'] as const;
const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  company: 'Company',
  title: 'Job Title',
  city: 'City',
  country: 'Country',
};

type ParsedRow = Record<string, string>;

type ManualContact = {
  first_name: string;
  last_name: string;
  email: string;
  original_company: string;
  original_title: string;
  city: string;
  country: string;
};

const EMPTY_MANUAL: ManualContact = {
  first_name: '', last_name: '', email: '',
  original_company: '', original_title: '', city: '', country: '',
};

function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { firstName: '', lastName: '', email: '', company: '', title: '', city: '', country: '' };
  const matchers: Record<keyof ColumnMapping, RegExp[]> = {
    firstName: [/first.*name/i, /fname/i, /given.*name/i, /^first$/i],
    lastName: [/last.*name/i, /lname/i, /surname/i, /family.*name/i, /^last$/i],
    email: [/email/i, /e-mail/i, /mail/i],
    company: [/company/i, /org/i, /organization/i, /employer/i, /firm/i, /business/i],
    title: [/title/i, /position/i, /role/i, /job/i, /designation/i],
    city: [/city/i, /town/i, /municipality/i, /location/i],
    country: [/country/i, /nation/i, /land/i, /region/i],
  };
  for (const header of headers) {
    for (const [field, patterns] of Object.entries(matchers) as [keyof ColumnMapping, RegExp[]][]) {
      if (!mapping[field] && patterns.some((p) => p.test(header))) mapping[field] = header;
    }
  }
  return mapping;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const router = useRouter();

  // ── Manual entry state ──────────────────────────────────────────────────
  const [form, setForm] = useState<ManualContact>(EMPTY_MANUAL);
  const [manualList, setManualList] = useState<ManualContact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualResult, setManualResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFormChange = (field: keyof ManualContact, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddToList = () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    setManualList(prev => [...prev, { ...form }]);
    setForm(EMPTY_MANUAL);
  };

  const handleRemoveFromList = (idx: number) => {
    setManualList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleManualSubmit = async () => {
    // Add current form if filled
    const toSubmit = [...manualList];
    if (form.first_name.trim() || form.last_name.trim()) {
      toSubmit.push({ ...form });
    }
    if (toSubmit.length === 0) return;

    setIsSubmitting(true);
    setManualResult(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: toSubmit }),
      });
      const data = await res.json();
      if (res.ok) {
        setManualResult({ success: true, message: `Added ${data.count} contact${data.count !== 1 ? 's' : ''} successfully!` });
        setManualList([]);
        setForm(EMPTY_MANUAL);
        setTimeout(() => router.push('/contacts'), 1500);
      } else {
        setManualResult({ success: false, message: data.error || 'Failed to add contacts' });
      }
    } catch {
      setManualResult({ success: false, message: 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CSV state ───────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ firstName: '', lastName: '', email: '', company: '', title: '', city: '', country: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((f: File) => {
    setFile(f); setImportResult(null);
    Papa.parse<ParsedRow>(f, { header: true, skipEmptyLines: true, preview: 6, complete: (results) => {
      const hdrs = results.meta.fields || [];
      setHeaders(hdrs); setPreviewRows(results.data.slice(0, 5)); setMapping(guessColumnMapping(hdrs));
    }});
    Papa.parse<ParsedRow>(f, { header: true, skipEmptyLines: true, complete: (results) => { setAllRows(results.data); }});
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'text/csv' || droppedFile?.name.endsWith('.csv')) parseFile(droppedFile);
    else alert('Please upload a CSV file');
  }, [parseFile]);

  const handleImport = async () => {
    if (!file || allRows.length === 0) return;
    const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missingRequired.length > 0) { alert(`Please map: ${missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}`); return; }
    setIsImporting(true); setImportResult(null);
    try {
      const contacts = allRows.map((row) => ({
        first_name: mapping.firstName ? row[mapping.firstName] || '' : '',
        last_name: mapping.lastName ? row[mapping.lastName] || '' : '',
        email: mapping.email ? row[mapping.email] || '' : '',
        original_company: mapping.company ? row[mapping.company] || '' : '',
        original_title: mapping.title ? row[mapping.title] || '' : '',
        city: mapping.city ? row[mapping.city] || '' : '',
        country: mapping.country ? row[mapping.country] || '' : '',
      }));
      const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts }) });
      const data = await res.json();
      if (res.ok) { setImportResult({ success: true, count: data.count, message: data.message }); setTimeout(() => router.push('/contacts'), 2000); }
      else setImportResult({ success: false, count: 0, message: data.error || 'Import failed' });
    } catch { setImportResult({ success: false, count: 0, message: 'Network error during import' }); }
    finally { setIsImporting(false); }
  };

  const totalToAdd = manualList.length + (form.first_name.trim() || form.last_name.trim() ? 1 : 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Contacts</h1>
        <p className="text-gray-500 text-sm mt-1">Add contacts manually or import from a CSV file</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          ✏️ Add Manually
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'csv' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📄 Import CSV
        </button>
      </div>

      {/* ── MANUAL TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Enter contact details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. Satya" value={form.first_name}
                  onChange={e => handleFormChange('first_name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddToList()}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. Nadella" value={form.last_name}
                  onChange={e => handleFormChange('last_name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddToList()}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" placeholder="e.g. satya@microsoft.com" value={form.email}
                  onChange={e => handleFormChange('email', e.target.value)}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input type="text" placeholder="e.g. Microsoft" value={form.original_company}
                  onChange={e => handleFormChange('original_company', e.target.value)}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
                <input type="text" placeholder="e.g. CEO" value={form.original_title}
                  onChange={e => handleFormChange('original_title', e.target.value)}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                <input type="text" placeholder="e.g. Munich" value={form.city}
                  onChange={e => handleFormChange('city', e.target.value)}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                <input type="text" placeholder="e.g. Germany" value={form.country}
                  onChange={e => handleFormChange('country', e.target.value)}
                  className="input w-full" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleAddToList}
                disabled={!form.first_name.trim() && !form.last_name.trim()}
                className="btn-secondary flex items-center gap-2 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another
              </button>
              <span className="text-xs text-gray-400">or press Enter to add another person</span>
            </div>
          </div>

          {/* Queued list */}
          {manualList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Queued — {manualList.length} contact{manualList.length !== 1 ? 's' : ''} ready to add
              </h2>
              <div className="space-y-2">
                {manualList.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                        {(c.first_name[0] || c.last_name[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
                        {(c.original_company || c.original_title) && (
                          <span className="text-xs text-gray-500 ml-2">
                            {[c.original_title, c.original_company].filter(Boolean).join(' @ ')}
                          </span>
                        )}
                        {(c.city || c.country) && (
                          <span className="text-xs text-gray-400 ml-2">· {[c.city, c.country].filter(Boolean).join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveFromList(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting || totalToAdd === 0}
              className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {totalToAdd > 0 ? `Add & Enrich ${totalToAdd} contact${totalToAdd !== 1 ? 's' : ''}` : 'Add & Enrich'}
                </>
              )}
            </button>
            {totalToAdd === 0 && <p className="text-sm text-gray-400">Fill in at least a first or last name</p>}
          </div>

          {/* Result */}
          {manualResult && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${manualResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {manualResult.success
                ? <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              }
              <div>
                <p className={`text-sm font-medium ${manualResult.success ? 'text-green-800' : 'text-red-800'}`}>{manualResult.message}</p>
                {manualResult.success && <p className="text-xs text-green-600 mt-1">Redirecting to contacts...</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CSV TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">1. Upload CSV File</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              {file ? (
                <div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{allRows.length > 0 ? `${allRows.length.toLocaleString()} rows found` : 'Parsing...'}</p>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); setHeaders([]); setPreviewRows([]); setAllRows([]); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="mt-2 text-xs text-red-500 hover:text-red-700">Remove file</button>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Drag & drop your CSV file here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                  <p className="text-xs text-gray-400 mt-3">Supports CSV files up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {headers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">2. Map Columns</h2>
              <p className="text-xs text-gray-500 mb-4">Match your CSV columns to the required fields.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => {
                  const isRequired = REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]);
                  return (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{FIELD_LABELS[field]}{isRequired && <span className="text-red-500 ml-1">*</span>}</label>
                      <select value={mapping[field]} onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))} className={`input text-sm ${isRequired && !mapping[field] ? 'border-red-300 focus:ring-red-500' : ''}`}>
                        <option value="">-- Not mapped --</option>
                        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">3. Preview (First 5 Rows)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).filter((f) => mapping[f]).map((field) => (
                      <th key={field} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{FIELD_LABELS[field]}<span className="text-gray-400 font-normal ml-1">({mapping[field]})</span></th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).filter((f) => mapping[f]).map((field) => (
                          <td key={field} className="px-3 py-2 text-gray-700">{row[mapping[field]] || <span className="text-gray-300">empty</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {file && headers.length > 0 && (
            <div className="flex items-center gap-4">
              <button onClick={handleImport} disabled={isImporting || REQUIRED_FIELDS.some((f) => !mapping[f])} className="btn-primary flex items-center gap-2 px-6 py-3">
                {isImporting ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Importing {allRows.length.toLocaleString()} contacts...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Import {allRows.length.toLocaleString()} Contacts</>
                )}
              </button>
              {REQUIRED_FIELDS.some((f) => !mapping[f]) && <p className="text-sm text-red-500">Please map: {REQUIRED_FIELDS.filter((f) => !mapping[f]).map((f) => FIELD_LABELS[f]).join(', ')}</p>}
            </div>
          )}

          {importResult && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {importResult.success
                ? <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              }
              <div>
                <p className={`text-sm font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>{importResult.message}</p>
                {importResult.success && <p className="text-xs text-green-600 mt-1">Redirecting to contacts...</p>}
              </div>
            </div>
          )}

          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Tips</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• First row should contain column headers</li>
              <li>• At minimum, include First Name and Last Name columns</li>
              <li>• Adding Company and Title helps improve enrichment accuracy</li>
              <li>• Email addresses help verify identity during enrichment</li>
              <li>• Supports files with up to ~5,000 rows</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
