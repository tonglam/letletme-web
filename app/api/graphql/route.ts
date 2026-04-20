import { NextRequest, NextResponse } from 'next/server';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

const isCacheableQuery = (query: unknown): boolean => {
  if (typeof query !== 'string') {
    return false;
  }
  return (
    query.includes('eventOverallResult') ||
    query.includes('GetEventStatsById') ||
    query.includes('event(id:')
  );
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const cacheable = isCacheableQuery(body?.query);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheable
          ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
          : 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from GraphQL server' },
      { status: 500 }
    );
  }
}
