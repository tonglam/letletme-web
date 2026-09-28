const assert = require('node:assert/strict')
const { test } = require('node:test')
const { AsyncLocalStorage } = require('node:async_hooks')

// Exercise Next's installed implementation, including the cache write promise.
globalThis.AsyncLocalStorage = AsyncLocalStorage
const { unstable_cache } = require('next/dist/server/web/spec-extension/unstable-cache')
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external')
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external')
const { AfterContext } = require('next/dist/server/after/after-context')
const { executeRevalidates } = require('next/dist/server/revalidation-utils')

function deferred() {
 let resolve, reject
 const promise = new Promise((yes, no) => { resolve = yes; reject = no })
 return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

function requestScope({ cached = { price: 100 }, writeGate } = {}) {
 const lifetimes = []
 const writes = []
 const cacheRead = deferred()
 const store = {
  route: '/cache-lifetime-test',
  pendingRevalidates: {},
  incrementalCache: {
   generateSimpleCacheKey: async key => key,
   get: async () => {
    await cacheRead.promise
    return cached === null ? null : { isStale: true, value: { kind: 'FETCH', data: { body: JSON.stringify(cached) } } }
   },
   set: async (_key, value) => {
    if (writeGate) await writeGate.promise
    writes.push(JSON.parse(value.data.body))
   }
  },
  afterContext: new AfterContext({ waitUntil: promise => lifetimes.push(promise), onClose: () => {}, onTaskError: error => { throw error } })
 }
 return { store, lifetimes, writes, cacheRead, run: callback => workAsyncStorage.run(store, () => workUnitAsyncStorage.run({ type: 'request', phase: 'render', url: new URL('http://localhost/cache-lifetime-test') }, callback)) }
}

for (const cold of [false, true]) {
 test(`${cold ? 'cold fill' : 'stale refresh'} discovered after the render snapshot owns origin and cache write`, async () => {
  const origin = deferred(), write = deferred()
  const scope = requestScope({ cached: cold ? null : { price: 100 }, writeGate: write })
  const load = unstable_cache(() => origin.promise, ['lifetime', String(cold)], { revalidate: 300 })
  const result = scope.run(load)
  assert.equal(executeRevalidates(scope.store), false, 'stream shell snapshots before asynchronous cache lookup')
  scope.cacheRead.resolve()
  await tick()
  if (!cold) assert.deepEqual(await result, { price: 100 }, 'stale response remains non-blocking')
  origin.resolve({ price: 101 })
  await result
  await tick()
  assert.ok(scope.lifetimes.length > 0, 'late background work must register a platform lifetime')
  let finished = false
  const settled = Promise.all(scope.lifetimes).then(() => { finished = true })
  await tick()
  assert.equal(finished, false, 'origin completion alone must not release the invocation')
  assert.equal(scope.writes.length, 0)
  write.resolve()
  await settled
  assert.deepEqual(scope.writes, [{ price: 101 }])
 })
}

test('a failed stale refresh preserves cache and a later request can recover', async () => {
 let calls = 0
 const load = unstable_cache(async () => {
  if (++calls === 1) throw new Error('fixture origin unavailable')
  return { price: 101 }
 }, ['failure-retry'], { revalidate: 300 })
 const first = requestScope()
 first.cacheRead.resolve()
 assert.deepEqual(await first.run(load), { price: 100 })
 assert.ok(first.lifetimes.length > 0)
 await Promise.all(first.lifetimes)
 assert.deepEqual(first.writes, [])
 const second = requestScope()
 second.cacheRead.resolve()
 assert.deepEqual(await second.run(load), { price: 100 })
 await Promise.all(second.lifetimes)
 assert.deepEqual(second.writes, [{ price: 101 }])
 assert.equal(calls, 2)
})

test('repeated stale reads share one refresh and one registered lifetime', async () => {
 const origin = deferred()
 const scope = requestScope()
 let calls = 0
 const load = unstable_cache(() => { calls++; return origin.promise }, ['repeat-refresh'], { revalidate: 300 })
 scope.cacheRead.resolve()
 const values = await scope.run(() => Promise.all([load(), load()]))
 assert.deepEqual(values, [{ price: 100 }, { price: 100 }])
 assert.equal(calls, 1)
 assert.equal(scope.lifetimes.length, 1)
 origin.resolve({ price: 101 })
 await Promise.all(scope.lifetimes)
 assert.deepEqual(scope.writes, [{ price: 101 }])
})
