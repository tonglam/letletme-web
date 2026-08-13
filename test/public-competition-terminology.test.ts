import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

type Messages = Record<string, unknown>

const readMessages = (locale: string): Messages =>
	JSON.parse(
		fs.readFileSync(path.join(process.cwd(), 'messages', `${locale}.json`), 'utf8')
	) as Messages

const get = (messages: Messages, namespace: string, key: string): string => {
	const value = (messages[namespace] as Record<string, unknown> | undefined)?.[key]
	assert.equal(typeof value, 'string', `${namespace}.${key} must exist`)
	return value as string
}

const walkStrings = (
	value: unknown,
	currentPath: string[] = []
): Array<{ path: string; value: string }> => {
	if (typeof value === 'string') {
		return [{ path: currentPath.join('.'), value }]
	}
	if (!value || typeof value !== 'object') return []

	return Object.entries(value).flatMap(([key, child]) =>
		walkStrings(child, [...currentPath, key])
	)
}

const publicExceptionPaths = new Set([
	'PageMetadata.tournamentStatsTitle',
	'TournamentStats.title',
	'Navigation.myTournament'
])

test('public competition copy is complete and contains no accidental legacy terminology', () => {
	const locales = [
		{
			name: 'en',
			messages: readMessages('en'),
			navigation: {
				live: 'Live',
				myFpl: 'My FPL',
				competitions: 'Competitions',
				explore: 'Explore',
				myCompetitions: 'My Competitions',
				createCompetition: 'Create Competition',
				myTournament: 'My Tournament'
			},
			home: {
				liveCompetitionStandings: 'Live competition standings',
				browseCompetitions: 'Browse competitions',
				createCompetition: 'Create competition',
				competitionQuickLinks: 'Competition shortcuts',
				privateCompetitions: 'Private competitions'
			}
		},
		{
			name: 'zh-CN',
			messages: readMessages('zh-CN'),
			navigation: {
				live: '实时',
				myFpl: '我的 FPL',
				competitions: '赛事',
				explore: '探索',
				myCompetitions: '我的赛事',
				createCompetition: '创建赛事',
				myTournament: '我的锦标赛'
			},
			home: {
				liveCompetitionStandings: '赛事实时积分榜',
				browseCompetitions: '浏览赛事',
				createCompetition: '创建赛事',
				competitionQuickLinks: '赛事快捷入口',
				privateCompetitions: '私人赛事'
			}
		}
	] as const

	for (const locale of locales) {
		for (const [key, expected] of Object.entries(locale.navigation)) {
			assert.equal(get(locale.messages, 'Navigation', key), expected, `${locale.name} Navigation.${key}`)
		}
		for (const [key, expected] of Object.entries(locale.home)) {
			assert.equal(get(locale.messages, 'Home', key), expected, `${locale.name} Home.${key}`)
		}

		const legacyTerm = locale.name === 'en' ? /tournament/i : /锦标赛/
		for (const entry of walkStrings(locale.messages)) {
			const withoutPlaceholders = entry.value.replace(/\{[^}]+\}/g, '')
			if (publicExceptionPaths.has(entry.path)) continue
			assert.doesNotMatch(
				withoutPlaceholders,
				legacyTerm,
				`${locale.name} has a legacy public term at ${entry.path}: ${entry.value}`
			)
		}
	}
})

test('competition navigation and homepage entry routes remain aligned', () => {
	const config = fs.readFileSync(path.join(process.cwd(), 'components/layout/config.ts'), 'utf8')
	const home = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/page.tsx'), 'utf8')

	for (const href of [
		"href: '/live/competitions'",
		"href: '/competitions/browse?mine=true'",
		"href: '/competitions/create'",
		"href: '/my-fpl/competitions'"
	]) {
		assert.match(config, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
	}

	assert.match(home, /href="\/live\/competitions"[\s\S]*liveCompetitionStandings/)
	assert.match(home, /href="\/competitions\/browse"[\s\S]*browseCompetitions/)
	assert.match(home, /href="\/competitions\/create"[\s\S]*createCompetition/)
})
