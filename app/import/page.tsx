'use client';

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

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

function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    city: '',
    country: '',
  };

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
      if (!mapping[field] && patterns.some((p) => p.test(header))) {
        mapping[field] = header;
      }
    }
  }

  return mapping;
}

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    city: '',
    country: '',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const parseFile = useCallback((f: File) => {
    setFile(f);
    setImportResult(null);

    Papa.parse<ParsedRow>(f, {
      header: true,
      skipEmptyLines: true,
      preview: 6,
      complete: (results) => {
        const hdrs = results.meta.fields || [];
        setHeaders(hdrs);
        setPreviewRows(results.data.slice(0, 5));
        setMapping(guessColumnMapping(hdrs));
      },
    });

    // Parse full file for row count
    Papa.parse<ParsedRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setAllRows(results.data);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type === 'text/csv' || droppedFile?.name.endsWith('.csv')) {
        parseFile(droppedFile);
      } else {
        alert('Please upload a CSV file');
      }
    },
    [parseFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) parseFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file || allRows.length === 0) return;

    // Validate mapping
    const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missingRequired.length > 0) {
      alert(`Please map these required fields: ${missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}`);
      return;
    }

    setIsImporting(true);
    setImportResult(null);

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

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult({ success: true, count: data.count, message: data.message });
        setTimeout(() => router.push('/contacts'), 2000);
      } else {
        setImportResult({ success: false, count: 0, message: data.error || 'Import failed' });
      }
    } catch (error) {
      setImportResult({ success: false, count: 0, message: 'Network error during import' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a CSV file with contact records to start enrichment
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">1. Upload CSV File</h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {allRows.length > 0 ? `${allRows.length.toLocaleString()} rows found` : 'Parsing...'}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setHeaders([]);
                  setPreviewRows([]);
                  setAllRows([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                Drag & drop your CSV file here
              </p>
              <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              <p className="text-xs text-gray-400 mt-3">Supports CSV files up to 10MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Column Mapping */}
      {headers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">2. Map Columns</h2>
          <p className="text-xs text-gray-500 mb-4">
            Match your CSV columns to the required fields. Fields marked with * are required.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => {
              const isRequired = REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]);
              return (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {FIELD_LABELS[field]}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    className={`input text-sm ${
                      isRequired && !mapping[field] ? 'border-red-300 focus:ring-red-500' : ''
                    }`}
                  >
                    <option value="">-- Not mapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">3. Preview (First 5 Rows)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[])
                    .filter((f) => mapping[f])
                    .map((field) => (
                      <th
                        key={field}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                      >
                        {FIELD_LABELS[field]}
                        <span className="text-gray-400 font-normal ml-1">({mapping[field]})</span>
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[])
                      .filter((f) => mapping[f])
                      .map((field) => (
                        <td key={field} className="px-3 py-2 text-gray-700">
                          {row[mapping[field]] || <span className="text-gray-300">empty</span>}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && headers.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleImport}
            disabled={isImporting || REQUIRED_FIELDS.some((f) => !mapping[f])}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            {isImporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importing {allRows.length.toLocaleString()} contacts...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import {allRows.length.toLocaleString()} Contacts
              </>
            )}
          </button>

          {REQUIRED_FIELDS.some((f) => !mapping[f]) && (
            <p className="text-sm text-red-500">
              Please map required fields: {REQUIRED_FIELDS.filter((f) => !mapping[f]).map((f) => FIELD_LABELS[f]).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {importResult.success ? (
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <div>
            <p className={`text-sm font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {importResult.message}
            </p>
            {importResult.success && (
              <p className="text-xs text-green-600 mt-1">Redirecting to contacts...</p>
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-blue-50 rounded-xl border border-blue-100 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Tips</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• First row should contain column headers</li>
          <li>• At minimum, include First Name and Last Name columns</li>
          <li>• Adding Company and Title helps improve enrichment accuracy</li>
          <li>• Email addresses help verify identity during enrichment</li>
          <li>• Supports files with up to ~5,000 rows for optimal performance</li>
        </ul>
      </div>
    </div>
  );
}
