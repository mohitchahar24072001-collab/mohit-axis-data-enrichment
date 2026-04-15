'use client';

import { useEffect, useState, useCallback } from 'react';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

interface Stats {
  total: number;
  enriched: number;
  pending: number;
  failed: number;
  enriching: number;
}

interface ActivityItem {
  id: number;
  contact_id: number | null;
  action: string;
  details: string | null;
  created_at: string;
  contact_name?: string;
}

interface EnrichmentStatus {
  isEnriching: boolean;
  queueLength: number;
  currentId: number | null;
  processedCount: number;
  failedCount: number;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    enrichment_started: 'Started enriching',
    enrichment_completed: 'Enrichment completed',
    enrichment_failed: 'Enrichment failed',
    import_completed: 'Contacts imported',
    manual_override: 'Manual override applied',
  };
  return labels[action] || action;
}

function getActionColor(action: string): string {
  if (action.includes('completed')) return 'text-green-600';
  if (action.includes('failed')) return 'text-red-600';
  if (action.includes('started')) return 'text-blue-600';
  return 'text-gray-600';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, enriched: 0, pending: 0, failed: 0, enriching: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, activityRes, statusRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/stats?activity=true'),
        fetch('/api/enrich'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data.activity || []);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setEnrichmentStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStartEnrichment = async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: 'all' }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to start enrichment:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopEnrichment = async () => {
    try {
      const res = await fetch('/api/enrich', {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to stop enrichment:', error);
    }
  };

  const completionPercentage = stats.total > 0
    ? Math.round((stats.enriched / stats.total) * 100)
    : 0;

  const isCurrentlyEnriching = enrichmentStatus?.isEnriching || stats.enriching > 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor your contact enrichment progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/import"
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </Link>
          {isCurrentlyEnriching ? (
            <button
              onClick={handleStopEnrichment}
              className="btn-danger flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
              </svg>
              Stop Enrichment
            </button>
          ) : (
            <button
              onClick={handleStartEnrichment}
              disabled={isStarting || stats.pending === 0}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isStarting ? 'Starting...' : 'Start Enrichment'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Contacts"
            value={stats.total}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="blue"
          />
          <StatsCard
            title="Enriched"
            value={stats.enriched}
            subtitle={`${completionPercentage}% complete`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="green"
          />
          <StatsCard
            title="Pending"
            value={stats.pending + stats.enriching}
            subtitle={stats.enriching > 0 ? `${stats.enriching} currently processing` : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="yellow"
          />
          <StatsCard
            title="Failed"
            value={stats.failed}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            color="red"
          />
        </div>
      )}

      {/* Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Enrichment Progress</h2>
            {isCurrentlyEnriching && (
              <span className="flex items-center gap-2 text-sm text-blue-600">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Processing...
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>{stats.enriched} enriched</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>{stats.total} total</span>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Pending', value: stats.pending, color: 'bg-gray-400' },
              { label: 'Enriching', value: stats.enriching, color: 'bg-blue-500' },
              { label: 'Enriched', value: stats.enriched, color: 'bg-green-500' },
              { label: 'Failed', value: stats.failed, color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
                <div>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Enrichment info */}
          {enrichmentStatus && isCurrentlyEnriching && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Queue status:</span>{' '}
                {enrichmentStatus.queueLength} remaining •{' '}
                {enrichmentStatus.processedCount} processed •{' '}
                {enrichmentStatus.failedCount} failed
              </p>
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-6 flex items-center gap-3">
            <Link href="/contacts" className="btn-secondary text-sm">
              View All Contacts
            </Link>
            {stats.failed > 0 && (
              <button
                onClick={async () => {
                  const failedRes = await fetch('/api/contacts?status=failed&limit=1000');
                  if (failedRes.ok) {
                    const { contacts } = await failedRes.json();
                    const ids = contacts.map((c: { id: number }) => c.id);
                    await fetch('/api/enrich', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids }),
                    });
                    fetchData();
                  }
                }}
                className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
              >
                Retry Failed ({stats.failed})
              </button>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {activity.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300 mt-1">Import contacts to get started</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activity.map((item) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${getActionColor(item.action)}`}>
                      {getActionLabel(item.action)}
                    </p>
                    {item.contact_name && (
                      <p className="text-xs text-gray-700 font-medium truncate">{item.contact_name}</p>
                    )}
                    {item.details && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.details}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && stats.total === 0 && (
        <div className="mt-8 bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No contacts yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Import a CSV file with your contact records to start enriching them with current employment information.
          </p>
          <Link href="/import" className="btn-primary">
            Import Your First CSV
          </Link>
        </div>
      )}
    </div>
  );
}
