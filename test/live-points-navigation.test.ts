import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const homeStats = readFileSync('components/home/StatsSection.tsx', 'utf8')
const entryPage = readFileSync('app/[locale]/live/points/[id]/page.tsx', 'utf8')
const teamPoints = readFileSync(
	'app/live/points/[id]/TeamPointsClient.tsx',
	'utf8'
)
const dashboard = readFileSync(
	'app/live/points/_components/LivePointsDashboard.tsx',
	'utf8'
)
const transfers = readFileSync(
	'app/live/points/_components/LivePointsTransfers.tsx',
	'utf8'
)
const pitchDetailHook = readFileSync(
	'app/live/points/_hooks/useLivePlayerDetail.ts',
	'utf8'
)
const tournamentReview = readFileSync(
	'app/me/tournament/TournamentReviewV2Client.tsx',
	'utf8'
)

describe('live points navigation context', () => {
	it('remounts transfer details for the displayed entry and gameweek', () => {
		assert.match(dashboard, /liveData\.event === gameweek/)
		assert.match(dashboard, /key=\{`\$\{liveData\.entry\}:\$\{gameweek\}`\}/)
		assert.match(transfers, /week\.eventId === eventId/)
		assert.match(transfers, /return \(\) => controller\.abort\(\)/)
	})

	it('keeps transfer failures separate from empty records without deriving hits', () => {
		assert.match(transfers, /if \(controller\.signal\.aborted\) return/)
		assert.match(transfers, /setFailed\(true\)/)
		assert.match(transfers, /failed \? \(/)
		assert.match(transfers, /moves\.length === 0/)
		assert.doesNotMatch(transfers, /eventTransfersCost|transferCost/)
	})
	it('displays transfer-history prices in the millions returned by GraphQL', () => {
		assert.match(transfers, /value\.toFixed\(1\)/)
		assert.doesNotMatch(transfers, /value\s*\/\s*10/)
	})

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

	it('links tournament review directly to the formal live board query', () => {
		assert.match(
			tournamentReview,
			/href=\{`\/live\/competitions\?tournamentId=\$\{selectedTournament\.tournamentId\}/
		)
		assert.match(tournamentReview, /eventId \? `&gw=\$\{eventId\}`/)
	})

	it('keeps player detail selection scoped to player and gameweek', () => {
		assert.match(pitchDetailHook, /const nextKey = `\$\{eventId\}:\$\{playerId\}`/)
		assert.match(pitchDetailHook, /selection\.eventId !== eventId/)
		assert.match(pitchDetailHook, /Promise\.allSettled\(\[/)
		assert.match(pitchDetailHook, /requestId !== requestIdRef\.current/)
		assert.match(pitchDetailHook, /cancelled = true/)
		assert.match(dashboard, /isLoading=\{pitchPlayerDetail\.isLoading\}/)
	})
})
