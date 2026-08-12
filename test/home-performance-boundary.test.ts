import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const home = readFileSync('app/[locale]/page.tsx', 'utf8')
const personalDesk = readFileSync('components/home/PersonalDesk.tsx', 'utf8')
const desktopNav = readFileSync('components/layout/DesktopNav.tsx', 'utf8')
const mobileNav = readFileSync('components/layout/MobileNav.tsx', 'utf8')
const proxy = readFileSync('proxy.ts', 'utf8')

describe('Home first-screen performance boundary', () => {
	it('keeps the public Hero independent from verified session I/O', () => {
		assert.match(home, /getTranslations\('Home'\)/)
		assert.match(
			home,
			/Promise\.all\(\[\s*getTranslations\('Home'\),\s*hasSessionCookieHint\(\)/
		)
		assert.match(home, /if \(!hasSessionCookie\) return null/)
		assert.ok(
			home.indexOf('if (!hasSessionCookie) return null') <
				home.indexOf('await getVerifiedEntryContext()')
		)
		assert.match(home, /export const dynamic = 'force-dynamic'/)
		assert.ok(
			home.indexOf('<HomePersonalHydratedMarker enabled />') >
				home.indexOf('await getVerifiedEntryContext()')
		)
	})

	it('starts entry and league queries before awaiting the entry response', () => {
		const entryStart = personalDesk.indexOf('const entryPromise =')
		const leaguesStart = personalDesk.indexOf('const leaguesPromise =')
		const entryAwait = personalDesk.indexOf('const [entryData, t] =')
		assert.ok(entryStart >= 0)
		assert.ok(leaguesStart > entryStart)
		assert.ok(entryAwait > leaguesStart)
		assert.match(personalDesk, /timeoutMs: 4_000/g)
	})

	it('disables speculative prefetch for hidden and secondary routes', () => {
		assert.match(
			home,
			/<Link\s+href="\/live\/tournaments"\s+prefetch=\{false\}/
		)
		assert.match(desktopNav, /href=\{subItem\.href\}\s+prefetch=\{false\}/)
		assert.match(desktopNav, /href="\/auth\/login"\s+prefetch=\{false\}/)
		assert.match(mobileNav, /href=\{subItem\.href\} prefetch=\{false\}/)
		assert.match(mobileNav, /href="\/auth\/login" prefetch=\{false\}/)
	})

	it('keeps public HTML cacheable only when no session cookie is hinted', () => {
		assert.match(proxy, /hasSessionCookieHintInHeaders\(req\.headers\)/)
		assert.match(proxy, /private, no-store, no-transform/)
	})

	it('measures concurrent Home completion after consuming every response stream', () => {
		const measurement = readFileSync(
			'scripts/measure-home-performance.mjs',
			'utf8'
		)
		assert.match(measurement, /await response\.arrayBuffer\(\)/)
	})
})
