import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const toastLayouts = [
	'app/[locale]/explore/fixtures/layout.tsx',
	'app/[locale]/explore/market/layout.tsx',
	'app/[locale]/explore/selections/layout.tsx',
	'app/[locale]/live/layout.tsx',
	'app/[locale]/onboarding/layout.tsx',
	'app/[locale]/profile/layout.tsx'
]

describe('route-local toast boundary', () => {
	it('mounts the lazy toaster on every route family that emits notifications', () => {
		for (const layoutPath of toastLayouts) {
			const layout = readFileSync(layoutPath, 'utf8')
			assert.match(layout, /import \{ AppToaster \}/)
			assert.match(layout, /<AppToaster \/>/)
		}
	})

	it('does not ship pathname routing or Sonner through the Home locale layout', () => {
		const toaster = readFileSync('components/feedback/AppToaster.tsx', 'utf8')
		const localeLayout = readFileSync('app/[locale]/layout.tsx', 'utf8')
		assert.doesNotMatch(toaster, /usePathname|TOAST_ROUTES/)
		assert.doesNotMatch(localeLayout, /AppToaster|sonner/)
	})
})
