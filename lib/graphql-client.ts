const getGraphQLEndpoint = () => {
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT
  }
  // Server-side (RSC/route handlers): call backend directly, skip the proxy
  if (typeof window === 'undefined') {
    return process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
  }
  // Client-side: always go through the proxy so cookies/auth are forwarded
  return `${window.location.origin}/api/graphql`
}

interface ExecuteQueryOptions {
  cache?: RequestCache
  next?: { revalidate?: number | false; tags?: string[] }
  headers?: Record<string, string>
}

type GraphQLErrorLike = {
  message?: string
  path?: string[]
  extensions?: unknown
}

const normalizeGraphQLErrors = (errors: unknown): GraphQLErrorLike[] => {
  if (errors == null) return []
  if (Array.isArray(errors)) {
    return errors
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map((item) =>
        typeof item === 'object' ? (item as GraphQLErrorLike) : { message: String(item) },
      )
  }
  if (typeof errors === 'object') {
    return Object.keys(errors as Record<string, unknown>).length > 0
      ? [errors as GraphQLErrorLike]
      : []
  }
  if (typeof errors === 'string' && errors.trim().length > 0) {
    return [{ message: errors }]
  }
  return []
}

const extensionsHasDetail = (extensions: unknown): boolean => {
  if (extensions == null || typeof extensions !== 'object') return false
  return Object.keys(extensions as Record<string, unknown>).length > 0
}

const isMeaningfulGraphQLError = (err: GraphQLErrorLike): boolean => {
  const msg =
    typeof err.message === 'string' && err.message.trim().length > 0
      ? err.message.trim()
      : ''
  if (msg.length > 0) return true
  if (Array.isArray(err.path) && err.path.length > 0) return true
  if (extensionsHasDetail(err.extensions)) return true
  const keys = Object.keys(err as Record<string, unknown>)
  if (keys.length === 0) return false
  if (keys.length === 1 && keys[0] === 'message') return false
  return keys.some((key) => {
    if (key === 'message' || key === 'path' || key === 'extensions') return false
    const value = (err as Record<string, unknown>)[key]
    return value != null && value !== ''
  })
}

const safeSerializeForLog = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

async function doFetch<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  cache: RequestCache,
  next: ExecuteQueryOptions['next'],
  isClient: boolean,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  try {
    const fetchOptions: RequestInit & { next?: ExecuteQueryOptions['next'] } = {
      method: 'POST',
      cache,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ query, variables }),
    }

    if (isClient) fetchOptions.credentials = 'include'
    if (next) fetchOptions.next = next

    const response = await fetch(endpoint, fetchOptions)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    const normalizedErrors = normalizeGraphQLErrors(result.errors)
    const meaningfulErrors = normalizedErrors.filter(isMeaningfulGraphQLError)

    if (meaningfulErrors.length > 0) {
      const errorMessages = meaningfulErrors
        .map((err, index: number) => {
          const fallback =
            typeof err === 'object' && err !== null
              ? safeSerializeForLog(err)
              : String(err)
          const safeFallback =
            fallback && fallback !== '{}' && fallback !== 'null'
              ? fallback
              : `Unknown GraphQL error at index ${index}`
          const message =
            err?.message && err.message.trim().length > 0
              ? err.message.trim()
              : safeFallback
          const path = Array.isArray(err?.path) ? ` at ${err.path.join('.')}` : ''
          return `${message}${path}`
        })
        .join('; ')

      console.warn(
        `GraphQL errors: ${errorMessages}`,
        '\nraw:',
        safeSerializeForLog(result.errors),
      )

      throw new Error(`GraphQL Error: ${errorMessages || 'Unknown GraphQL error'}`)
    }

    if (result.errors != null && normalizedErrors.length > 0) {
      console.warn(
        'GraphQL response contained error entries with no usable details; using data if present.',
        safeSerializeForLog(result.errors),
      )
    }

    if (result.data === undefined || result.data === null) {
      throw new Error(
        result.errors != null
          ? 'GraphQL response missing data (errors present but not parseable).'
          : 'GraphQL response missing data.',
      )
    }

    return result.data as T
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : safeSerializeForLog(error)
    console.error(`GraphQL query error [${endpoint}]: ${message}`)
    throw error
  }
}

// Tracks in-flight client-side requests to deduplicate simultaneous identical calls
const pendingClientRequests = new Map<string, Promise<unknown>>()

export async function executeQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: ExecuteQueryOptions,
): Promise<T> {
  const isClient = typeof window !== 'undefined'
  const endpoint = getGraphQLEndpoint()
  const cache = options?.cache ?? 'no-store'

  if (isClient) {
    const key = `${cache}::${query}::${JSON.stringify(variables ?? null)}`
    const pending = pendingClientRequests.get(key) as Promise<T> | undefined
    if (pending) return pending

    const promise = doFetch<T>(endpoint, query, variables, cache, options?.next, true).finally(
      () => pendingClientRequests.delete(key),
    )
    pendingClientRequests.set(key, promise)
    return promise
  }

  return doFetch<T>(endpoint, query, variables, cache, options?.next, false, options?.headers)
}
