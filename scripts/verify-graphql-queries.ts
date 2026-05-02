/**
 * Smoke-test every exported query document in lib/graphql/queries.ts
 * against a GraphQL HTTP endpoint (default: production `/api/graphql`).
 *
 * Usage:
 *   npx tsx scripts/verify-graphql-queries.ts
 *
 * Env:
 *   GRAPHQL_VERIFY_URL — HTTP endpoint (default: GRAPHQL_ENDPOINT, then prod `/api/graphql`)
 *   GRAPHQL_ENDPOINT — when set (e.g. from `.env`), hits GraphQL upstream directly → full suite
 *   VERIFY_ENTRY_ID (default 15702)
 *   VERIFY_TOURNAMENT_ID — when using prod `/api/graphql` without cookies, tournaments cannot be
 *     fetched (`entryTournaments` is session-only); set this to exercise tournament queries.
 *
 * Mirrors `USER_CONTEXT_PATTERNS` in `app/api/graphql/route.ts` for anonymous proxy skips.
 *
 * Static alignment with backend **schema** (field/arg types, introspection + `graphql.validate`):
 * `npx tsx scripts/validate-queries-vs-schema.ts`.
 */
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	GET_ENTRY_TOURNAMENTS,
	GET_ENTRY_TRANSFER_HISTORY,
	GET_EVENT_FIXTURES,
	GET_EVENT_LIVE_EXPLAIN,
	GET_EVENT_OVERALL_RESULT,
	GET_EVENT_STATS_BY_ID,
	GET_LIVE_MATCHES,
	GET_LIVE_POINTS,
	GET_LIVE_SCORES,
	GET_PLAYER_DETAIL,
	GET_PLAYER_LIVE,
	GET_PLAYER_VALUE_HISTORY,
	GET_PLAYER_VALUES,
	GET_PLAYERS_FOR_PICKER,
	GET_TEAMS_FOR_PICKER,
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	GET_TOURNAMENT_EVENT_RESULTS,
	GET_TOURNAMENT_LIVE_POINTS,
	GET_TOURNAMENT_SELECTION_STATS,
	utcCalendarDateISO
} from '../lib/graphql/queries'

/** Keep in sync with `app/api/graphql/route.ts` `USER_CONTEXT_PATTERNS`. */
const PROXY_USER_CONTEXT_SNIPPETS = [
	'entryHistory(',
	'entryTransferHistory(',
	'calcLivePointsByEntry(',
	'entryTournaments(',
	'tournamentLivePoints(',
	'tournamentEntryRankingSummary('
] as const

function queryRequiresSignedSessionViaProxy(doc: string): boolean {
	return PROXY_USER_CONTEXT_SNIPPETS.some(s => doc.includes(s))
}

function endpointIsLetsiteProxy(url: string): boolean {
	try {
		const u = new URL(url)
		return (
			u.pathname.replace(/\/$/, '').endsWith('/api/graphql') &&
			/\.letletme\.top$/i.test(u.hostname ?? '')
		)
	} catch {
		return false
	}
}

function shouldSkipDueToAnonymousProxy(endpoint: string, doc: string): boolean {
	return (
		queryRequiresSignedSessionViaProxy(doc) && endpointIsLetsiteProxy(endpoint)
	)
}

const endpoint =
	process.env.GRAPHQL_VERIFY_URL ??
	process.env.GRAPHQL_ENDPOINT ??
	'https://www.letletme.top/api/graphql'

const tournamentIdFromEnv = (() => {
	const raw = process.env.VERIFY_TOURNAMENT_ID
	if (!raw?.trim()) return null
	const n = Number(raw)
	return Number.isFinite(n) ? n : null
})()

const entryIdDefault = Number(process.env.VERIFY_ENTRY_ID ?? '15702') || 15702

interface GraphqlPayload {
	data?: Record<string, unknown>
	errors?: Array<{ message: string }>
}

async function gql(
	query: string,
	variables?: Record<string, unknown>
): Promise<GraphqlPayload> {
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, variables })
	})
	const raw = await res.text()
	let body: GraphqlPayload
	try {
		body = JSON.parse(raw) as GraphqlPayload
	} catch {
		throw new Error(
			`${endpoint} returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 400)}`
		)
	}
	if (!res.ok) {
		throw new Error(`${endpoint} HTTP ${res.status}: ${JSON.stringify(body)}`)
	}
	return body
}

type Case = {
	name: string
	query: string
	variables?: Record<string, unknown> | undefined
	skip?: boolean
}

async function main() {
	const results: Array<{
		name: string
		status: 'ok' | 'fail' | 'skip'
		detail?: string
	}> = []

	console.log(`Verifying queries against ${endpoint}\n`)

	const boot = await gql(GET_CURRENT_AND_NEXT_EVENTS)
	const eventIdRaw = boot.data?.current as { id?: number }[] | undefined
	const eventId = eventIdRaw?.[0]?.id
	if (boot.errors?.length) {
		console.error(boot.errors)
		process.exit(1)
	}
	if (typeof eventId !== 'number') {
		console.error('Bootstrap failed: no current event id', boot.data)
		process.exit(1)
	}

	const entryId = entryIdDefault
	let tournamentId: number | null = tournamentIdFromEnv
	if (tournamentId == null && !endpointIsLetsiteProxy(endpoint)) {
		const tout = await gql(GET_ENTRY_TOURNAMENTS, { entryId })
		if (tout.errors?.length) {
			console.error('GET_ENTRY_TOURNAMENTS', tout.errors)
			process.exit(1)
		}
		const tournamentList = tout.data?.entryTournaments as Array<{ id: number }>
		tournamentId = tournamentList?.[0]?.id ?? null
	}

	const pickRes = await gql(GET_PLAYERS_FOR_PICKER, {
		filter: null,
		limit: 10,
		offset: 0
	})
	const players = pickRes.data?.players as Array<{ id: number }>
	const playerId = players?.[0]?.id ?? 355

	const cases: Case[] = [
		{
			name: 'GET_CURRENT_AND_NEXT_EVENTS',
			query: GET_CURRENT_AND_NEXT_EVENTS
		},
		{
			name: 'GET_ENTRY_TOURNAMENTS',
			query: GET_ENTRY_TOURNAMENTS,
			variables: { entryId }
		},
		{
			name: 'GET_TOURNAMENT_EVENT_RESULTS',
			query: GET_TOURNAMENT_EVENT_RESULTS,
			variables: { tournamentId, eventId },
			skip: tournamentId === null
		},
		{
			name: 'GET_TOURNAMENT_ENTRY_RANKING_SUMMARY',
			query: GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
			variables: { tournamentId, eventId, entryId },
			skip: tournamentId === null
		},
		{
			name: 'GET_EVENT_STATS_BY_ID',
			query: GET_EVENT_STATS_BY_ID,
			variables: { eventId }
		},
		{
			name: 'GET_TOURNAMENT_SELECTION_STATS',
			query: GET_TOURNAMENT_SELECTION_STATS,
			variables: { tournamentId, eventId, limit: 20 },
			skip: tournamentId === null
		},
		{
			name: 'GET_PLAYER_DETAIL',
			query: GET_PLAYER_DETAIL,
			variables: { playerId, eventId }
		},
		{
			name: 'GET_PLAYER_VALUES',
			query: GET_PLAYER_VALUES,
			variables: { changeDate: utcCalendarDateISO() }
		},
		{
			name: 'GET_PLAYERS_FOR_PICKER',
			query: GET_PLAYERS_FOR_PICKER,
			variables: { filter: null, limit: 20, offset: 0 }
		},
		{ name: 'GET_TEAMS_FOR_PICKER', query: GET_TEAMS_FOR_PICKER },
		{
			name: 'GET_PLAYER_VALUE_HISTORY',
			query: GET_PLAYER_VALUE_HISTORY,
			variables: { playerId, fromDate: null, toDate: null }
		},
		{ name: 'GET_EVENT_OVERALL_RESULT', query: GET_EVENT_OVERALL_RESULT },
		{
			name: 'GET_LIVE_SCORES',
			query: GET_LIVE_SCORES,
			variables: { eventId }
		},
		{
			name: 'GET_TOP_TRANSFERS_IN',
			query: GET_TOP_TRANSFERS_IN,
			variables: { eventId, limit: 10 }
		},
		{
			name: 'GET_TOP_TRANSFERS_OUT',
			query: GET_TOP_TRANSFERS_OUT,
			variables: { eventId, limit: 10 }
		},
		{
			name: 'GET_EVENT_FIXTURES',
			query: GET_EVENT_FIXTURES,
			variables: { eventId }
		},
		{
			name: 'GET_LIVE_POINTS',
			query: GET_LIVE_POINTS,
			variables: { eventId, entryId }
		},
		{
			name: 'GET_TOURNAMENT_LIVE_POINTS',
			query: GET_TOURNAMENT_LIVE_POINTS,
			variables: { eventId, tournamentId },
			skip: tournamentId === null
		},
		{
			name: 'GET_ENTRY_EVENT_RESULT',
			query: GET_ENTRY_EVENT_RESULT,
			variables: { entryId, eventId }
		},
		{
			name: 'GET_ENTRY_HISTORY',
			query: GET_ENTRY_HISTORY,
			variables: { entryId }
		},
		{
			name: 'GET_ENTRY_TRANSFER_HISTORY',
			query: GET_ENTRY_TRANSFER_HISTORY,
			variables: { entryId }
		},
		{ name: 'GET_LIVE_MATCHES', query: GET_LIVE_MATCHES },
		{
			name: 'GET_EVENT_LIVE_EXPLAIN',
			query: GET_EVENT_LIVE_EXPLAIN,
			variables: { eventId, elementId: playerId }
		},
		{
			name: 'GET_PLAYER_LIVE',
			query: GET_PLAYER_LIVE,
			variables: { playerId, eventId }
		}
	]

	for (const c of cases) {
		const anonProxyBlocked = shouldSkipDueToAnonymousProxy(endpoint, c.query)
		const noTournament = Boolean(c.skip)
		if (anonProxyBlocked || noTournament) {
			results.push({
				name: c.name,
				status: 'skip',
				detail:
					anonProxyBlocked && noTournament
						? 'anonymous /api/graphql + no tournament id'
						: anonProxyBlocked
							? 'anonymous /api/graphql (needs signed session)'
							: 'no tournament id (set VERIFY_TOURNAMENT_ID on proxy)'
			})
			continue
		}
		const out = await gql(c.query, c.variables)
		if (out.errors?.length) {
			results.push({
				name: c.name,
				status: 'fail',
				detail: out.errors.map(e => e.message).join('; ')
			})
			continue
		}
		results.push({ name: c.name, status: 'ok' })
	}

	const failed = results.filter(r => r.status === 'fail')
	const skipped = results.filter(r => r.status === 'skip')

	for (const r of results) {
		const suffix =
			r.status === 'fail' && r.detail
				? ` — ${r.detail}`
				: r.status === 'skip'
					? ` (skipped: ${r.detail ?? '—'})`
					: ''
		console.log(`[${r.status.toUpperCase()}] ${r.name}${suffix}`)
	}

	console.log(
		`\nsummary: ${results.length} cases; failed ${failed.length}; skipped ${skipped.length}`
	)
	console.log(
		`current event id: ${eventId}; entry ${entryId}; player ${playerId}; tournament ${tournamentId ?? 'none'}`
	)
	if (failed.length) process.exit(1)
}

main().catch((e: unknown) => {
	console.error(e)
	process.exit(1)
})
