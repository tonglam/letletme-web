import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

describe('server-first global shell performance boundary', () => {
	it('keeps theme and navigation disclosures out of the hydrated shell', () => {
		const layout = read('app/[locale]/layout.tsx')
		const clientNamespaces = read('i18n/client-namespaces.ts')
		const themeToggle = read('components/theme/ThemeToggle.tsx')
		const disclosureController = read(
			'components/layout/NavigationDisclosureController.tsx'
		)
		const navigationLink = read('components/layout/NavigationMenuLink.tsx')
		const miniProgram = read('components/layout/MiniProgramPopover.tsx')

		assert.doesNotMatch(layout, /ThemeProvider/)
		assert.match(layout, /data-cfasync="false"/)
		assert.doesNotMatch(clientNamespaces, /\n\s*'Theme',/)
		assert.match(layout, /data-navigation-disclosure/)
		assert.match(layout, /data-theme-choice/)
		for (const source of [
			themeToggle,
			disclosureController,
			navigationLink,
			miniProgram
		]) {
			assert.doesNotMatch(source, /['"]use client['"]/)
		}
		assert.doesNotMatch(themeToggle, /DropdownMenu|useTheme/)
		assert.doesNotMatch(
			miniProgram,
			/components\/ui\/popover|<Popover|useState|useRef/
		)
	})

	it('loads the report form and dialog dependencies only after activation', () => {
		const entry = read('components/feedback/ReportProblemEntry.tsx')
		const dialog = read('components/feedback/ReportProblemDialog.tsx')

		assert.match(entry, /lazy\(\(\) =>[\s\S]*import\('\.\/ReportProblemDialog'\)/)
		assert.doesNotMatch(entry, /components\/ui\/sheet|from 'sonner'/)
		assert.match(dialog, /components\/ui\/sheet/)
		assert.match(dialog, /from 'sonner'/)
	})
})

describe('live matches media performance boundary', () => {
	it('uses the image optimizer for every visible match-card crest', () => {
		const header = read('components/live/match-card/MatchHeader.tsx')
		const playerList = read('components/live/match-card/MatchPlayerList.tsx')
		const matchesClient = read('app/live/matches/LiveMatchesClient.tsx')

		assert.doesNotMatch(header, /unoptimized/)
		assert.doesNotMatch(playerList, /unoptimized/)
		assert.match(header, /sizes="\(min-width: 768px\) 36px, 32px"/)
		assert.equal((playerList.match(/sizes="16px"/g) ?? []).length, 2)
		assert.match(matchesClient, /<div className="min-h-4">/)
	})
})
