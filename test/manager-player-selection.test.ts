import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import type { PlayerDetail } from '../types/player-detail'

type Pick = { element: number; position: number; totalPoints: number; webName: string; teamName: string; teamShortName: string; elementTypeName: string; isPlayed: boolean; multiplier: number }
type Stats = { eventId: number; reviewSnapshot: { entryId: number; revision: string }; teamName: string; playerName: string; eventPicks: Pick[] }
const pick = (element = 1, totalPoints = 9, position = 1): Pick => ({ element, position, totalPoints, webName: `Player ${element}`, teamName: 'City', teamShortName: 'MCI', elementTypeName: 'FWD', isPlayed: true, multiplier: 3 })
const stats = (): Stats => ({ eventId: 3, reviewSnapshot: { entryId: 10, revision: 'r1' }, teamName: 'Team', playerName: 'Manager', eventPicks: [pick(), pick(2, 4, 12)] })
function harness() {
 const slots: unknown[] = []
 let cursor = 0
 let effects: (() => void)[] = []
 let modal: { player: PlayerDetail | null; isOpen: boolean; onClose: () => void }
 let pitch: { onPlayerClick: (id: string, opener: unknown) => void }
 const exports: { TeamSquadPitch?: (props: { stats: Stats }) => unknown } = {}
 const jsx = (type: string, props: Record<string, unknown>) => {
  if (type === 'modal') modal = props as typeof modal
  if (type === 'pitch') pitch = props as typeof pitch
  return { type, props }
 }
 const load = (name: string) => {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
  if (name === 'react') return {
   useState(value: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next: unknown) => { slots[i] = next }] },
   useRef(value: unknown) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }) },
   useMemo(fn: () => unknown) { return fn() }, useCallback(fn: unknown) { return fn }, useEffect(fn: () => void) { effects.push(fn) }
  }
  if (name === 'next-intl') return { useLocale: () => 'en', useTranslations: () => (key: string) => key, useFormatter: () => ({ number: String }) }
  if (name.endsWith('/SquadPitch')) return { SquadPitch: 'pitch' }
  if (name.endsWith('/PlayerDetailModal')) return { PlayerDetailModal: 'modal' }
  if (name.endsWith('/ShareActions')) return { ShareActions: 'share' }
  if (name.endsWith('/routing')) return { localizePathname: (url: string) => url }
  if (name.endsWith('/squad-picks')) return { isSquadStarter: (p: Pick) => p.position <= 11 }
  if (name.endsWith('/squad-pitch-team-codes')) return { resolveSquadTeamCode: () => 'MCI' }
  if (name.endsWith('/team-stats-url')) return { teamStatsGameweekHref: (event: number) => `/my-fpl/team?gw=${event}` }
  throw new Error(`Unexpected dependency ${name}`)
 }
 const source = ts.transpileModule(readFileSync('app/me/team/_components/TeamSquadPitch.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
 new Function('require', 'exports', source)(load, exports)
 return {
  render(value: Stats) { cursor = 0; effects = []; exports.TeamSquadPitch!({ stats: value }); for (const effect of effects) effect(); return modal },
  open(id = '1') { pitch.onPlayerClick(id, {}) }, close() { modal.onClose() }
 }
}

test('open detail derives current snapshot points without multiplying captain points', () => {
 const h = harness(); const s = stats(); h.render(s); h.open()
 assert.equal(h.render(s).player?.points, 9)
 assert.equal(h.render(s).player?.breakdownSource, 'snapshot')
 s.eventPicks = [pick(1, 12), pick(2, 4, 12)]
 assert.equal(h.render(s).player?.points, 12)
 h.close(); assert.equal(h.render(s).isOpen, false)
 h.open('bench-2'); assert.equal(h.render(s).player?.id, '2')
})
for (const change of ['event', 'revision', 'entry', 'removed'] as const) {
 test(`${change} invalidates selection and returning never resurrects the modal`, () => {
  const h = harness(); const before = stats(); h.render(before); h.open(); assert.equal(h.render(before).isOpen, true)
  const after = structuredClone(before)
  if (change === 'event') after.eventId = 4
  if (change === 'revision') after.reviewSnapshot.revision = 'r2'
  if (change === 'entry') after.reviewSnapshot.entryId = 20
  if (change === 'removed') after.eventPicks = [pick(3)]
  assert.equal(h.render(after).isOpen, false)
  assert.equal(h.render(before).isOpen, false)
  h.open(); assert.equal(h.render(before).isOpen, true)
 })
}
