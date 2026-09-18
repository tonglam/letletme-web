import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync('app/[locale]/briefing/admin/actions.ts', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function harness(options: { enabled?: string; user?: { id?: string; email?: string }; fail?: boolean } = {}) {
 const calls: unknown[][] = []
 const state = { user: options.user }
 const exports: { publishBriefingWeekEditionAction?: (data: FormData) => Promise<void> } = {}
 const env = { BRIEFING_ADMIN_ENABLED: options.enabled ?? 'true', BRIEFING_EDITOR_EMAILS: 'editor@test.invalid', BRIEFING_PUBLISHER_EMAILS: ' publisher@test.invalid ' }
 const load = (name: string) => {
  if (name === '@/lib/session') return { getCurrentSession: async () => state.user ? { user: state.user } : null }
  if (name === '@/lib/briefing-admin-server') return { publishBriefingWeekEdition: async (...args: unknown[]) => { calls.push(args); if (options.fail) throw new Error('fixture downstream unavailable') } }
  throw new Error(`Unexpected dependency ${name}`)
 }
 new Function('require', 'exports', 'process', compiled)(load, exports, { env })
 return { calls, state, run: exports.publishBriefingWeekEditionAction! }
}
function validForm() {
 const form = new FormData()
 form.set('editionId', ' edition-7 ')
 form.set('expectedFrozenSha256', ` ${'AB'.repeat(32)} `)
 form.set('reason', ' verified publication ')
 return form
}

test('disabled, anonymous, editor and unlisted sessions cannot issue Data commands', async () => {
 for (const options of [{ enabled: 'false', user: { id: 'p', email: 'publisher@test.invalid' } }, {}, { user: { email: 'editor@test.invalid' } }, { user: { email: 'other@test.invalid' } }]) {
  const h = harness(options)
  await assert.rejects(h.run(validForm()), /Briefing admin (is disabled|role required)/)
  assert.deepEqual(h.calls, [])
 }
})
test('publisher sends normalized fields and a stable edition/hash idempotency key', async () => {
 const h = harness({ user: { id: 'actor-7', email: ' PUBLISHER@TEST.INVALID ' } })
 await h.run(validForm())
 await h.run(validForm())
 const hash = 'ab'.repeat(32)
 assert.deepEqual(h.calls, Array.from({ length: 2 }, () => ['edition-7', { expectedFrozenSha256: hash, validUntil: null, reason: 'verified publication' }, { actorId: 'actor-7', idempotencyKey: `web:briefing:publish:edition-7:${hash}` }]))
})
test('missing fields, file values and invalid hashes never reach Data', async () => {
 for (const field of ['editionId', 'expectedFrozenSha256', 'reason']) {
  for (const value of ['', '   ', new Blob(['invalid'])]) {
   const h = harness({ user: { id: 'actor', email: 'publisher@test.invalid' } })
   const form = validForm(); form.set(field, value)
   await assert.rejects(h.run(form), /required/)
   assert.equal(h.calls.length, 0)
  }
 }
 const h = harness({ user: { email: 'publisher@test.invalid' } })
 const form = validForm(); form.set('expectedFrozenSha256', 'not-a-sha')
 await assert.rejects(h.run(form), /invalid/)
 assert.equal(h.calls.length, 0)
})
test('each action rechecks session and propagates downstream failure', async () => {
 const h = harness({ user: { id: 'actor', email: 'publisher@test.invalid' }, fail: true })
 const form = validForm(); form.set('validUntil', ' 2026-09-20T00:00:00Z ')
 await assert.rejects(h.run(form), /fixture downstream unavailable/)
 assert.equal((h.calls[0][1] as { validUntil: string }).validUntil, '2026-09-20T00:00:00Z')
 h.state.user = { id: 'actor', email: 'editor@test.invalid' }
 await assert.rejects(h.run(form), /role required/)
 assert.equal(h.calls.length, 1)
})
