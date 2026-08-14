import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const home = readFileSync('app/[locale]/page.tsx', 'utf8')
const personalDesk = readFileSync('components/home/PersonalDesk.tsx', 'utf8')
const homeServerData = readFileSync('lib/home-data-server.ts', 'utf8')
const leagueList = readFileSync(
	'components/home/PersonalLeagueRankList.tsx',
	'utf8'
)
const matches = readFileSync('components/home/MatchesSection.tsx', 'utf8')
const guestNavigation = readFileSync(
	'components/layout/GuestNavigationActions.tsx',
	'utf8'
)
const proxy = readFileSync('proxy.ts', 'utf8')

describe('Home first-screen performance boundary', () => {
	it('starts the revision-pinned public bootstrap before child rendering', () => {
		assert.match(home, /void getHomePublicBootstrap\(\)/)
		assert.doesNotMatch(home, /GET_EVENT_OVERALL_RESULT/)
		assert.doesNotMatch(home, /GET_EVENT_FIXTURES/)
		assert.doesNotMatch(home, /getCurrentAndNextEvents/)
		assert.match(home, /export const dynamic = 'force-dynamic'/)
	})

	it('keeps guest Home independent from verified session I/O', () => {
		assert.match(
			home,
			/Promise\.all\(\[\s*getTranslations\('Home'\),\s*hasSessionCookieHint\(\)/
		)
		assert.match(home, /if \(!hasSessionCookie\) return null/)
		assert.ok(
			home.indexOf('if (!hasSessionCookie) return null') <
				home.indexOf('await getHomeVerifiedEntryContext()')
		)
	})

	it('loads the complete bound Team Desk with one compact protected query', () => {
		assert.equal(
			(homeServerData.match(/executeServerQueryWithSession</g) ?? []).length,
			1
		)
		assert.match(homeServerData, /GET_HOME_PERSONAL_DESK/)
		assert.match(homeServerData, /timeoutMs: 1_500/)
		for (const removed of [
			'GET_ENTRY_LEAGUES',
			'GET_ENTRY_OFFICIAL_H2H_DESK',
			'GET_ENTRY,',
			'<Suspense'
		]) {
			assert.doesNotMatch(personalDesk, new RegExp(removed))
		}
	})

	it('keeps league rows compact and performs no background requests', () => {
		for (const removed of [
			'executeQuery',
			'GET_ENTRY_OFFICIAL_H2H_DESK',
			'usePageActive',
			'setInterval',
			'officialH2H',
			'totalTeamNum',
			'matchPoints',
			'opponent'
		]) {
			assert.doesNotMatch(leagueList, new RegExp(removed))
		}
		assert.match(leagueList, /row\.name/)
		assert.match(leagueList, /row\.rank/)
		assert.match(leagueList, /row\.movement\.direction/)
		assert.match(leagueList, /HOME_LEAGUE_RANKS_READY/)
		assert.doesNotMatch(personalDesk, /personalLeaguesCount/)
		assert.doesNotMatch(leagueList, /visible\.length\}\/\{rows\.length/)
	})

	it('switches fixtures through one GET route without shipping GraphQL or Radix tabs', () => {
		assert.match(matches, /fetch\(`\/api\/home\/fixtures\?eventId=\$\{eventId\}`/)
		assert.match(matches, /new AbortController\(\)/)
		assert.match(matches, /requestGeneration !== generation\.current/)
		assert.match(matches, /startTransition\(\(\) => setCommitted/)
		assert.match(matches, /role="tablist"/)
		assert.doesNotMatch(matches, /graphql-client|GET_EVENT_FIXTURES|@\/components\/ui\/tabs/)
		assert.doesNotMatch(matches, /unoptimized/)
		assert.doesNotMatch(matches, /from 'sonner'/)
	})

	it('renders the guest navigation without Better Auth client code', () => {
		assert.doesNotMatch(guestNavigation, /auth-client|useSession|signOut/)
		assert.match(guestNavigation, /<details/)
		assert.match(guestNavigation, /prefetch=\{false\}/)
	})

	it('keeps personalized HTML private when a session cookie is hinted', () => {
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
