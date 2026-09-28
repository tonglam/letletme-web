import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createFormatter } from 'next-intl'
import ts from 'typescript'

// Execute the component with the actual next-intl formatter. Only React's
// lifecycle is controlled: the provider remains UTC while the viewer differs.
function renderTimestamp(locale: 'en' | 'zh-CN', capturedAt: string, dateOnly: boolean) {
 const formatter = createFormatter({ locale, timeZone: 'UTC' })
 let label: string | null = null
 let effect: (() => void) | undefined
 type Element = { props: { children: string; dateTime: string } }
 const exports: { MarketLocalUpdated?: (props: object) => Element } = {}
 const code = ts.transpileModule(readFileSync('components/data/MarketLocalUpdated.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
 }).outputText
 runInNewContext(code, {
  exports, Intl, Date,
  require(name: string) {
   if (name === 'next-intl') return { useFormatter: () => formatter, useTranslations: () => (_key: string, values: { date: string }) => values.date }
   if (name === 'react') return {
    useState: () => [label, (value: string) => { label = value }],
    useEffect: (callback: () => void) => { effect = callback }
   }
   if (name === 'react/jsx-runtime') return { jsx: (_type: string, props: Element['props']) => ({ props }) }
   throw new Error(`Unexpected import: ${name}`)
  }
 })
 const props = { capturedAt, dateOnly }
 const server = exports.MarketLocalUpdated!(props)
 effect!()
 return { server, hydrated: exports.MarketLocalUpdated!(props) }
}

for (const locale of ['en', 'zh-CN'] as const) {
 for (const timeZone of ['UTC', 'Australia/Perth']) {
  for (const dateOnly of [true, false]) {
   it(`formats ${locale} ${timeZone} dateOnly=${dateOnly} across midnight with a UTC provider`, () => {
    const original = process.env.TZ
    process.env.TZ = timeZone
    try {
     const capturedAt = '2026-09-26T23:00:10.632Z'
     const { server, hydrated } = renderTimestamp(locale, capturedAt, dateOnly)
     assert.equal(server.props.children, '…', 'SSR and the initial client render retain the same placeholder')
     assert.equal(hydrated.props.dateTime, capturedAt)
     const options: Intl.DateTimeFormatOptions = { timeZone, day: 'numeric', month: 'short' }
     if (!dateOnly) Object.assign(options, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })
     assert.equal(hydrated.props.children, new Intl.DateTimeFormat(locale, options).format(new Date(capturedAt)))
    } finally {
     if (original === undefined) delete process.env.TZ
     else process.env.TZ = original
    }
   })
  }
 }
}

it('preserves an invalid source timestamp without throwing', () => {
 assert.equal(renderTimestamp('en', 'unavailable', false).hydrated.props.children, 'unavailable')
})
