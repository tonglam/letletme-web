import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const homeStats = readFileSync('components/home/StatsSection.tsx', 'utf8')
const entryPage = readFileSync('app/[locale]/live/points/[id]/page.tsx', 'utf8')
const teamPoints = readFileSync(
	'app/live/points/[id]/TeamPointsClient.tsx',
	'utf8'
)

describe('live points navigation context', () => {
	it('marks the Home highest-score link as a Home-origin entry', () => {
		assert.match(
			homeStats,
			/\/live\/points\/\$\{overview\.highestScoringEntry\}\?gw=\$\{currentEventId\}&from=home/
		)
	})

	it('passes the Home-origin marker through the localized entry route', () => {
		assert.match(
			entryPage,
			/const \{ from, gw, tournamentId \} = await searchParams/
		)
		assert.match(entryPage, /from=\{from === 'home' \? 'home' : undefined\}/)
	})

	it('returns non-competition entry pages Home instead of inventing a competition', () => {
		assert.match(
			teamPoints,
			/const hasCompetitionContext = Boolean\(tournamentId\) && from !== 'home'/
		)
		assert.match(teamPoints, /: '\/'\n\n\tlet content/)
		assert.match(
			teamPoints,
			/hasCompetitionContext \? t\('backTournament'\) : t\('backHome'\)/
		)
	})
})
