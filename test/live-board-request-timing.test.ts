import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { RequestTiming } from '../lib/request-timing'
import { appendServerTiming } from '../lib/server-timing'

const compiled = ts.transpileModule(readFileSync('app/api/live/competitions/[id]/board/route.ts', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

for (const mode of ['success', 'anonymous', 'auth-failure', 'query-failure'] as const) {
 test(`board timings preserve ${mode} response and authorization boundary`, async () => {
  let now = 0
  let queryCalls = 0
  const result = { entryLiveCompetitionBoard: { filteredEntries: 1 } }
  const exports: { POST?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } = {}
  class QueryError extends Error {}
  const load = (name: string) => {
   if (name === 'next/server') return { NextResponse: Response }
   if (name === 'node:crypto') return { randomUUID: () => 'opaque-test-request' }
   if (name === '@/lib/request-timing') return { RequestTiming: class extends RequestTiming { constructor() { super(() => now) } } }
   if (name === '@/lib/server-timing') return { appendServerTiming }
   if (name === '@/lib/graphql-client') return { GraphQLRequestError: QueryError }
   if (name === '@/lib/graphql/operations/tournaments') return { GET_ENTRY_LIVE_COMPETITION_BOARD: 'board' }
   if (name === '@/lib/session') return { getVerifiedEntryContext: async () => {
    now += 10
    if (mode === 'auth-failure') throw new Error('private auth failure')
    return { entryId: mode === 'anonymous' ? null : 123, session: { user: { id: 'private-user' } } }
   } }
   if (name === '@/lib/graphql-server') return { executeServerQueryWithSession: async () => {
    queryCalls++
    now += 20
    if (mode === 'query-failure') throw new Error('private upstream failure')
    return result
   } }
   throw new Error(`Unexpected dependency ${name}`)
  }
  new Function('require', 'exports', compiled)(load, exports)
  const response = await exports.POST!(new Request('https://test.invalid/api/live/competitions/3/board', { method: 'POST', body: JSON.stringify({ eventId: 5 }) }), { params: Promise.resolve({ id: '3' }) })
  const queried = mode === 'success' || mode === 'query-failure'
  assert.equal(queryCalls, queried ? 1 : 0)
  assert.equal(response.status, { success: 200, anonymous: 401, 'auth-failure': 503, 'query-failure': 502 }[mode])
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('x-request-id'), 'opaque-test-request')
  assert.equal(response.headers.get('server-timing'), queried ? 'auth;dur=10, graphql;dur=20, total;dur=30' : 'auth;dur=10, total;dur=10')
  if (mode === 'success') assert.deepEqual(await response.json(), result)
  else assert.doesNotMatch(await response.text(), /private-user|private auth|private upstream/)
  if (mode === 'auth-failure') assert.equal(response.headers.get('retry-after'), '30')
 })
}
