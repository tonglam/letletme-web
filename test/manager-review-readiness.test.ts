import assert from 'node:assert/strict'
import test from 'node:test'
import { eventResultFromManagerGameweek } from '../app/me/team/_lib/manager-review-projection'
import { managerGameweek, managerSnapshot } from '../e2e/fixtures/manager-review'

test('historical manager results retain their own snapshot revision', () => {
 for (const eventId of [1, 2, 3]) {
  const source = managerGameweek(eventId)
  const projected = eventResultFromManagerGameweek(source)
  assert.deepEqual(projected?.reviewSnapshot, {
   ...source.snapshotMeta, entryId: source.entry!.id
  })
 }
})

test('missing or mismatched snapshots cannot provide readiness identity', () => {
 const source = managerGameweek(1)
 for (const input of [
  { ...source, snapshotMeta: null },
  { ...source, snapshotMeta: managerSnapshot(2) },
  { ...source, eventId: 2 }
 ]) {
  const projected = eventResultFromManagerGameweek(input)
  assert.equal(projected?.reviewSnapshot, undefined)
  assert.equal(projected?.eventId, 1)
 }
})

test('missing manager identity or result cannot produce a ready projection', () => {
 const source = managerGameweek(1)
 assert.equal(eventResultFromManagerGameweek({ ...source, entry: null }), null)
 assert.equal(eventResultFromManagerGameweek({ ...source, result: null }), null)
})

 test('historical status keeps the selected publication dates and settlement', () => {
  const source = managerGameweek(1)
  source.snapshotMeta = { ...managerSnapshot(1), publishedAt: '2026-08-01T01:02:03Z', sourceMaxCheckedAt: '2026-08-01T00:00:00Z', settlementState: 'DELAYED' }
  const projected = eventResultFromManagerGameweek(source)
  assert.equal(projected?.reviewSnapshot?.publishedAt, source.snapshotMeta.publishedAt)
  assert.equal(projected?.reviewSnapshot?.sourceMaxCheckedAt, source.snapshotMeta.sourceMaxCheckedAt)
  assert.equal(projected?.reviewSnapshot?.settlementState, 'DELAYED')
 })
