const getGraphQLEndpoint = () => {
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
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

type GraphQLErrorLike = {
  message?: string;
  path?: string[];
  extensions?: unknown;
};

const normalizeGraphQLErrors = (errors: unknown): GraphQLErrorLike[] => {
  if (errors == null) {
    return [];
  }
  if (Array.isArray(errors)) {
    return errors
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map((item) =>
        typeof item === 'object'
          ? (item as GraphQLErrorLike)
          : { message: String(item) },
      );
  }
  if (typeof errors === 'object') {
    // Some proxies return a single object instead of an array.
    return Object.keys(errors as Record<string, unknown>).length > 0
      ? [errors as GraphQLErrorLike]
      : [];
  }
  if (typeof errors === 'string' && errors.trim().length > 0) {
    return [{ message: errors }];
  }
  return [];
};

const extensionsHasDetail = (extensions: unknown): boolean => {
  if (extensions == null || typeof extensions !== 'object') {
    return false;
  }
  return Object.keys(extensions as Record<string, unknown>).length > 0;
};

/** Drop null entries and `{}` placeholders some gateways return with no message. */
const isMeaningfulGraphQLError = (err: GraphQLErrorLike): boolean => {
  const msg =
    typeof err.message === 'string' && err.message.trim().length > 0
      ? err.message.trim()
      : '';
  if (msg.length > 0) {
    return true;
  }
  if (Array.isArray(err.path) && err.path.length > 0) {
    return true;
  }
  if (extensionsHasDetail(err.extensions)) {
    return true;
  }
  const keys = Object.keys(err as Record<string, unknown>);
  if (keys.length === 0) {
    return false;
  }
  // Single empty message key only → not meaningful
  if (keys.length === 1 && keys[0] === 'message') {
    return false;
  }
  return keys.some((key) => {
    if (key === 'message' || key === 'path' || key === 'extensions') {
      return false;
    }
    const value = (err as Record<string, unknown>)[key];
    return value != null && value !== '';
  });
};

const safeSerializeForLog = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export async function executeQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: ExecuteQueryOptions,
): Promise<T> {
  const endpoint = getGraphQLEndpoint();
  const cache = options?.cache ?? 'no-store';
  
  try {
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

    const normalizedErrors = normalizeGraphQLErrors(result.errors);
    const meaningfulErrors = normalizedErrors.filter(isMeaningfulGraphQLError);

    if (meaningfulErrors.length > 0) {
      const errorMessages = meaningfulErrors
        .map((err, index: number) => {
          const fallback =
            typeof err === 'object' && err !== null
              ? safeSerializeForLog(err)
              : String(err);
          const safeFallback =
            fallback && fallback !== '{}' && fallback !== 'null'
              ? fallback
              : `Unknown GraphQL error at index ${index}`;
          const message =
            err?.message && err.message.trim().length > 0
              ? err.message.trim()
              : safeFallback;
          const path = Array.isArray(err?.path) ? ` at ${err.path.join('.')}` : '';
          return `${message}${path}`;
        })
        .join('; ');

      console.warn(
        `GraphQL errors: ${errorMessages}`,
        '\nraw:',
        safeSerializeForLog(result.errors),
      );

      throw new Error(`GraphQL Error: ${errorMessages || 'Unknown GraphQL error'}`);
    }

    if (result.errors != null && normalizedErrors.length > 0) {
      console.warn(
        'GraphQL response contained error entries with no usable details; using data if present.',
        safeSerializeForLog(result.errors),
      );
    }

    if (result.data === undefined || result.data === null) {
      throw new Error(
        result.errors != null
          ? 'GraphQL response missing data (errors present but not parseable).'
          : 'GraphQL response missing data.',
      );
    }

    return result.data as T;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : safeSerializeForLog(error)
    console.error(`GraphQL query error [${endpoint}]: ${message}`)
    throw error;
  }
}
