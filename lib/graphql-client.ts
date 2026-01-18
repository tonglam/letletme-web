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
export async function executeQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const endpoint = getGraphQLEndpoint();
  
  try {
    console.log('GraphQL Request:', {
      endpoint,
      query: query.substring(0, 100) + '...',
      variables
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
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
      const errorMessages = result.errors.map((err: { message: string; path?: string[]; extensions?: unknown }) => {
        const path = err.path ? ` at ${err.path.join('.')}` : '';
        return `${err.message}${path}`;
      }).join('; ');
      
      console.error('GraphQL errors:', {
        errors: result.errors,
        fullError: JSON.stringify(result.errors, null, 2)
      });
      
      throw new Error(`GraphQL Error: ${errorMessages}`);
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
