import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

describe('server-first global shell performance boundary', () => {
	it('keeps theme and navigation disclosures out of the hydrated shell', () => {
		const layout = read('app/[locale]/layout.tsx')
		const shellBootstrap = read('public/theme-bootstrap.js')
		const shellReady = read('components/layout/ShellControlsReady.tsx')
		const clientNamespaces = read('i18n/client-namespaces.ts')
		const themeToggle = read('components/theme/ThemeToggle.tsx')
		const disclosureController = read(
			'components/layout/NavigationDisclosureController.tsx'
		)
		const navigationLink = read('components/layout/NavigationMenuLink.tsx')
		const miniProgram = read('components/layout/MiniProgramPopover.tsx')
		const languageSwitcher = read('components/layout/LanguageSwitcher.tsx')

		assert.doesNotMatch(layout, /ThemeProvider/)
		assert.match(
			layout,
			/id="shell-controls-bootstrap"[\s\S]*data-cfasync="false"[\s\S]*src="\/theme-bootstrap\.js"[\s\S]*strategy="beforeInteractive"/
		)
		assert.doesNotMatch(layout, /dangerouslySetInnerHTML|themeBootstrapScript/)
		assert.doesNotMatch(layout, /blocking="render"/)
		assert.doesNotMatch(clientNamespaces, /\n\s*'Theme',/)
		assert.match(shellBootstrap, /data-navigation-disclosure/)
		assert.match(shellBootstrap, /data-theme-choice/)
		assert.match(shellBootstrap, /ArrowDown[\s\S]*role="radio"/)
		assert.match(shellBootstrap, /event\.metaKey[\s\S]*event\.defaultPrevented/)
		assert.match(
			shellBootstrap,
			/data-theme-transition-guard[\s\S]*transition:none/
		)
		assert.match(themeToggle, /data-theme-picker[\s\S]*inert/)
		assert.match(themeToggle, /tabIndex=/)
		assert.match(languageSwitcher, /tabIndex=/)
		assert.match(languageSwitcher, /<Link[\s\S]*locale="en"/)
		assert.match(languageSwitcher, /useSearchParams/)
		assert.match(languageSwitcher, /data-locale-link/)
		assert.match(languageSwitcher, /hashchange[\s\S]*popstate/)
		assert.match(
			languageSwitcher,
			/nextLocale === locale[\s\S]*removeAttribute\('open'\)/
		)
		assert.match(
			shellBootstrap,
			/data-locale-link[\s\S]*window\.location\.hash/
		)
		assert.match(shellBootstrap, /shellRadioGroupSelector[\s\S]*shellPicker/)
		assert.match(
			shellBootstrap,
			/Escape[\s\S]*closeDisclosures\(undefined, true\)/
		)
		assert.match(shellReady, /useEffect[\s\S]*letletme:shell-ready/)
		assert.match(shellBootstrap, /data-shell-hydrated[\s\S]*shellReadyEvent/)
		assert.match(
			shellBootstrap,
			/if \(shellControlsEnabled\) updateThemeControls\(theme\)/
		)
		assert.match(miniProgram, /left-0[\s\S]*sm:right-0/)
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
		const navigation = read('components/layout/NavigationActions.tsx')

		assert.match(
			entry,
			/lazy\(\(\) =>[\s\S]*import\('\.\/ReportProblemDialog'\)/
		)
		assert.doesNotMatch(entry, /components\/ui\/sheet|from 'sonner'/)
		assert.match(dialog, /components\/ui\/sheet/)
		assert.match(dialog, /from 'sonner'/)
		assert.match(
			entry,
			/cloneElement\(children[\s\S]*'aria-haspopup': 'dialog'/
		)
		assert.match(entry, /'aria-expanded': open/)
		assert.match(entry, /triggerLabel \?\? t\('entry'\)/)
		assert.match(
			navigation,
			/<ReportProblemEntry[\s\S]*triggerLabel=\{t\('reportProblem'\)\}[\s\S]*showReportIcon[\s\S]*\/>/
		)
		assert.doesNotMatch(navigation, /<ReportProblemEntry>\s*</)
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
