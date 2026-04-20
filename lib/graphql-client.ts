// GraphQL endpoint URL - uses environment variable or falls back to dev/prod based on NODE_ENV
// In development, use Next.js API route to avoid CORS issues
const getGraphQLEndpoint = () => {
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://www.letletme.top/graphql';
  }
  
  // In development, use Next.js API route (build absolute URL for client-side)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/graphql`;
  }
  
  return '/api/graphql';
};

// Helper function to execute GraphQL queries using fetch
interface ExecuteQueryOptions {
  cache?: RequestCache;
}

export async function executeQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: ExecuteQueryOptions,
): Promise<T> {
  const endpoint = getGraphQLEndpoint();
  const cache = options?.cache ?? 'no-store';
  
  try {
    console.log('GraphQL Request:', {
      endpoint,
      query: query.substring(0, 100) + '...',
      variables
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      cache,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      const errorMessages = result.errors
        .map((err: { message?: string; path?: string[]; extensions?: unknown }, index: number) => {
          const fallback =
            typeof err === 'object' && err !== null
              ? JSON.stringify(err)
              : String(err);
          const safeFallback =
            fallback && fallback !== '{}'
              ? fallback
              : `Unknown GraphQL error at index ${index}`;
          const message = err?.message && err.message.trim().length > 0
            ? err.message
            : safeFallback;
          const path = Array.isArray(err?.path) ? ` at ${err.path.join('.')}` : '';
          return `${message}${path}`;
        })
        .join('; ');
      
      console.error('GraphQL errors:', {
        errors: result.errors,
        fullError: JSON.stringify(result.errors, null, 2)
      });
      
      throw new Error(`GraphQL Error: ${errorMessages || 'Unknown GraphQL error'}`);
    }
    
    console.log('GraphQL Response:', result.data);
    return result.data as T;
  } catch (error) {
    console.error('GraphQL query error:', {
      endpoint,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}
