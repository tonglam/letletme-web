import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('persistent toast boundary', () => {
	it('activates the persistent toaster for every notification route family', () => {
		const toaster = readFileSync('components/feedback/AppToaster.tsx', 'utf8')
		for (const route of [
			'/competitions',
			'/explore',
			'/live',
			'/my-fpl',
			'/onboarding',
			'/profile'
		]) {
			assert.match(toaster, new RegExp(`'${route}'`))
		}
		assert.match(toaster, /pathname === '\/'/)
		assert.match(toaster, /if \(routeEmitsToasts\) setActivated\(true\)/)
		assert.doesNotMatch(toaster, /setActivated\(false\)/)
	})

	it('mounts Sonner synchronously after activation to preserve immediate feedback', () => {
		const toaster = readFileSync('components/feedback/AppToaster.tsx', 'utf8')
		const localeLayout = readFileSync('app/[locale]/layout.tsx', 'utf8')
		assert.match(localeLayout, /<AppToaster \/>/)
		assert.match(toaster, /if \(!activated\) return null/)
		assert.match(toaster, /import \{ Toaster \} from 'sonner'/)
		assert.doesNotMatch(toaster, /lazy\(|<Suspense/)
	})
})
