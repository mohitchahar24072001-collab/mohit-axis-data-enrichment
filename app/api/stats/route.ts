import { NextRequest, NextResponse } from 'next/server';
import { getStats, getRecentActivity } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeActivity = searchParams.get('activity') === 'true';

    const stats = await getStats();

    const response: Record<string, unknown> = { stats };

    if (includeActivity) {
      const activity = await getRecentActivity(20);
      response.activity = activity;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
