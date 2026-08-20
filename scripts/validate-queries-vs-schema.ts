/**
 * Prove each current GraphQL operation is **accepted by GraphQL.validate**
 * against the deployed schema (introspection). That is “matches the backend schema”, not merely
 * “server returned HTTP 200 once”.
 *
 * Requires introspection enabled on the endpoint (typical for dev / many internal APIs).
 *
 * Endpoint: `GRAPHQL_VERIFY_URL` → `GRAPHQL_ENDPOINT` → `.env.local` → `http://127.0.0.1:4000/graphql`.
 *
 * Usage: `npx tsx scripts/validate-queries-vs-schema.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
	buildClientSchema,
	buildSchema,
	getIntrospectionQuery,
	GraphQLSchema,
	parse,
	validate
} from 'graphql'
import { buildFixtureWindowQuery } from '../lib/fixture-window'
import {
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	GET_ENTRY_TRANSFER_HISTORY,
	SEARCH_ENTRIES
} from '../lib/graphql/operations/entries'
import {
	GET_CORE_EVENT_CONTEXT,
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_EVENT_FIXTURES,
	GET_EVENT_OVERALL_RESULT,
	GET_EVENT_STATS_BY_ID
} from '../lib/graphql/operations/events'
import {
	GET_EVENT_LIVE_EXPLAIN,
	GET_EVENT_LIVE_EXPLAINS,
	GET_LIVE_MATCHDAY_DESK,
	GET_LIVE_POINTS,
	GET_LIVE_SCORES,
	GET_LIVE_CONTEXT,
	GET_PLAYER_LIVE
} from '../lib/graphql/operations/live'
import {
	GET_FIXTURE_PLANNING_SIGNALS,
	GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK,
	GET_FIXTURE_PLANNING_OWNERSHIP_ROLLING_7D,
	GET_MARKET_PULSE,
	GET_MARKET_OWNERSHIP_DAY,
	GET_MARKET_OWNERSHIP_OVERVIEW
} from '../lib/graphql/operations/market'
import {
	GET_HOME_MARKET_OWNERSHIP,
	GET_HOME_MARKET_PULSE
} from '../lib/graphql/operations/home'
import {
	GET_PLAYER_DETAIL,
	GET_PLAYER_STATS_BOOTSTRAP,
	GET_PLAYER_STATS_DESK_CONTEXT,
	GET_PLAYER_STATS_DESK_OVERVIEW,
	GET_PLAYER_STATS_DESK_PROCESS,
	GET_PLAYER_STATS_DESK_PRODUCTION,
	GET_PLAYER_STATS_DESK_RECENT,
	GET_PLAYER_STATE_PROFILE,
	GET_PLAYERS_FOR_PICKER,
	SEARCH_PLAYERS_FOR_PICKER,
	GET_TEAMS_FOR_PICKER
} from '../lib/graphql/operations/players'
import {
	GET_PLAYER_VALUE_HISTORY,
	GET_PLAYER_VALUES,
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT
} from '../lib/graphql/operations/prices'
import {
	GET_ENTRY_OFFICIAL_H2H_DESK,
	GET_ENTRY_TOURNAMENTS,
	GET_MANAGED_TOURNAMENT,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	GET_TOURNAMENT_EVENT_RESULTS,
	GET_TOURNAMENT_LIVE_DESK,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_OFFICIAL_H2H,
	GET_TOURNAMENT_PARTICIPANTS,
	GET_TOURNAMENT_SELECTION_STATS
} from '../lib/graphql/operations/tournaments'
import { AGENT_GRAPHQL_DOCUMENTS } from '../lib/agent-tools/documents'

function hydrateGraphQlEnvFromLocalFile(): void {
	const p = path.join(process.cwd(), '.env.local')
	if (!existsSync(p)) return
	const text = readFileSync(p, 'utf8')
	for (let line of text.split('\n')) {
		line = line.trimEnd()
		if (line.startsWith('#') || !line.includes('=')) continue
		const ix = line.indexOf('=')
		const key = line.slice(0, ix).trim()
		if (
			key !== 'GRAPHQL_VERIFY_URL' &&
			key !== 'GRAPHQL_ENDPOINT' &&
			key !== 'GRAPHQL_SERVICE_TOKEN'
		)
			continue
		let value = line.slice(ix + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		if (!process.env[key]) process.env[key] = value
	}
}

hydrateGraphQlEnvFromLocalFile()

const endpoint =
	process.env.GRAPHQL_VERIFY_URL ??
	process.env.GRAPHQL_ENDPOINT ??
	'http://127.0.0.1:4000/graphql'

const OPERATIONS: ReadonlyArray<readonly [string, string]> = [
	['GET_CURRENT_AND_NEXT_EVENTS', GET_CURRENT_AND_NEXT_EVENTS],
	['GET_CORE_EVENT_CONTEXT', GET_CORE_EVENT_CONTEXT],
	['GET_PLAYER_STATS_BOOTSTRAP', GET_PLAYER_STATS_BOOTSTRAP],
	['GET_PLAYER_STATS_DESK_OVERVIEW', GET_PLAYER_STATS_DESK_OVERVIEW],
	['GET_PLAYER_STATS_DESK_CONTEXT', GET_PLAYER_STATS_DESK_CONTEXT],
	['GET_PLAYER_STATS_DESK_RECENT', GET_PLAYER_STATS_DESK_RECENT],
	['GET_PLAYER_STATS_DESK_PRODUCTION', GET_PLAYER_STATS_DESK_PRODUCTION],
	['GET_PLAYER_STATS_DESK_PROCESS', GET_PLAYER_STATS_DESK_PROCESS],
	['GET_ENTRY_TOURNAMENTS', GET_ENTRY_TOURNAMENTS],
	['GET_ENTRY_OFFICIAL_H2H_DESK', GET_ENTRY_OFFICIAL_H2H_DESK],
	['GET_TOURNAMENT_EVENT_RESULTS', GET_TOURNAMENT_EVENT_RESULTS],
	[
		'GET_TOURNAMENT_ENTRY_RANKING_SUMMARY',
		GET_TOURNAMENT_ENTRY_RANKING_SUMMARY
	],
	['GET_TOURNAMENT_PARTICIPANTS', GET_TOURNAMENT_PARTICIPANTS],
	['GET_TOURNAMENT_METADATA', GET_TOURNAMENT_METADATA],
	['GET_TOURNAMENT_OFFICIAL_H2H', GET_TOURNAMENT_OFFICIAL_H2H],
	['GET_MANAGED_TOURNAMENT', GET_MANAGED_TOURNAMENT],
	['GET_EVENT_STATS_BY_ID', GET_EVENT_STATS_BY_ID],
	['GET_TOURNAMENT_SELECTION_STATS', GET_TOURNAMENT_SELECTION_STATS],
	['GET_PLAYER_DETAIL', GET_PLAYER_DETAIL],
	['GET_PLAYER_STATE_PROFILE', GET_PLAYER_STATE_PROFILE],
	['GET_PLAYER_VALUES', GET_PLAYER_VALUES],
	['GET_HOME_MARKET_PULSE', GET_HOME_MARKET_PULSE],
	['GET_HOME_MARKET_OWNERSHIP', GET_HOME_MARKET_OWNERSHIP],
	['GET_MARKET_PULSE', GET_MARKET_PULSE],
	['GET_MARKET_OWNERSHIP_OVERVIEW', GET_MARKET_OWNERSHIP_OVERVIEW],
	['GET_MARKET_OWNERSHIP_DAY', GET_MARKET_OWNERSHIP_DAY],
	['GET_FIXTURE_PLANNING_SIGNALS', GET_FIXTURE_PLANNING_SIGNALS],
	[
		'GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK',
		GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK
	],
	[
		'GET_FIXTURE_PLANNING_OWNERSHIP_ROLLING_7D',
		GET_FIXTURE_PLANNING_OWNERSHIP_ROLLING_7D
	],
	['GET_PLAYERS_FOR_PICKER', GET_PLAYERS_FOR_PICKER],
	['SEARCH_PLAYERS_FOR_PICKER', SEARCH_PLAYERS_FOR_PICKER],
	['GET_TEAMS_FOR_PICKER', GET_TEAMS_FOR_PICKER],
	['GET_PLAYER_VALUE_HISTORY', GET_PLAYER_VALUE_HISTORY],
	['GET_EVENT_OVERALL_RESULT', GET_EVENT_OVERALL_RESULT],
	['GET_LIVE_SCORES', GET_LIVE_SCORES],
	['GET_LIVE_CONTEXT', GET_LIVE_CONTEXT],
	['GET_TOP_TRANSFERS_IN', GET_TOP_TRANSFERS_IN],
	['GET_TOP_TRANSFERS_OUT', GET_TOP_TRANSFERS_OUT],
	['GET_EVENT_FIXTURES', GET_EVENT_FIXTURES],
	['GET_FIXTURE_WINDOW_5', buildFixtureWindowQuery(5)],
	['GET_LIVE_POINTS', GET_LIVE_POINTS],
	['GET_TOURNAMENT_LIVE_DESK', GET_TOURNAMENT_LIVE_DESK],
	['SEARCH_ENTRIES', SEARCH_ENTRIES],
	['GET_ENTRY_EVENT_RESULT', GET_ENTRY_EVENT_RESULT],
	['GET_ENTRY_HISTORY', GET_ENTRY_HISTORY],
	['GET_ENTRY_TRANSFER_HISTORY', GET_ENTRY_TRANSFER_HISTORY],
	['GET_LIVE_MATCHDAY_DESK', GET_LIVE_MATCHDAY_DESK],
	['GET_EVENT_LIVE_EXPLAIN', GET_EVENT_LIVE_EXPLAIN],
	['GET_EVENT_LIVE_EXPLAINS', GET_EVENT_LIVE_EXPLAINS],
	['GET_PLAYER_LIVE', GET_PLAYER_LIVE],
	...Object.entries(AGENT_GRAPHQL_DOCUMENTS).map(
		([name, document]) => [`AGENT_${name}`, document] as const
	)
]

async function fetchSchema(endpointUrl: string): Promise<GraphQLSchema> {
	const res = await fetch(endpointUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(process.env.GRAPHQL_SERVICE_TOKEN
				? { 'X-GraphQL-Service-Token': process.env.GRAPHQL_SERVICE_TOKEN }
				: {})
		},
		body: JSON.stringify({ query: getIntrospectionQuery() }),
		cache: 'no-store'
	})
	const raw = await res.text()
	let parsed: unknown
	try {
		parsed = JSON.parse(raw) as {
			data?: unknown
			errors?: readonly { message?: string }[]
		}
	} catch {
		throw new Error(
			`Introspection: non-JSON from ${endpointUrl} (HTTP ${res.status}). ${raw.slice(0, 300)}`
		)
	}
	const body = parsed as {
		data?: Record<string, unknown>
		errors?: readonly { message?: string }[]
	}
	if (!res.ok) {
		throw new Error(`Introspection HTTP ${res.status}: ${JSON.stringify(body)}`)
	}
	if (body.errors?.length) {
		throw new Error(
			`Introspection rejected: ${body.errors.map(e => e.message ?? '?').join('; ')}`
		)
	}
	if (!body.data) {
		throw new Error(
			'Introspection returned no data (is __schema disabled on this server?)'
		)
	}
	return buildClientSchema(body.data as never, { assumeValid: false })
}

async function loadSchema(): Promise<GraphQLSchema> {
	const modulePath = process.env.GRAPHQL_SCHEMA_MODULE?.trim()
	if (!modulePath) return fetchSchema(endpoint)
	const imported = (await import(
		pathToFileURL(path.resolve(modulePath)).href
	)) as { schema?: unknown }
	if (
		!imported.schema ||
		typeof (imported.schema as { getTypeMap?: unknown }).getTypeMap !==
			'function'
	) {
		throw new Error(
			`GRAPHQL_SCHEMA_MODULE did not export a GraphQLSchema: ${modulePath}`
		)
	}
	// A sibling repository can own a separate `graphql` module instance. Print
	// with that instance and rebuild locally before calling local validation.
	const requireFromSchema = createRequire(
		pathToFileURL(path.resolve(modulePath))
	)
	const schemaGraphql = requireFromSchema('graphql') as {
		printSchema: (schema: unknown) => string
	}
	return buildSchema(schemaGraphql.printSchema(imported.schema))
}

async function main(): Promise<void> {
	console.log(
		process.env.GRAPHQL_SCHEMA_MODULE
			? `Loading schema from ${process.env.GRAPHQL_SCHEMA_MODULE}\n`
			: `Introspecting schema from ${endpoint}\n`
	)

	let schema: GraphQLSchema
	try {
		schema = await loadSchema()
	} catch (e) {
		console.error(e)
		process.exit(1)
	}

	let failed = 0
	for (const [name, doc] of OPERATIONS) {
		let ast
		try {
			ast = parse(doc)
		} catch (e) {
			failed += 1
			console.log(`[PARSE_FAIL] ${name}`)
			console.error(e)
			continue
		}
		const errs = validate(schema, ast)
		if (errs.length > 0) {
			failed += 1
			console.log(`[SCHEMA_FAIL] ${name}`)
			for (const err of errs) {
				console.log(`  ${err.message}`)
			}
		} else {
			console.log(`[OK] ${name}`)
		}
	}

	console.log(
		`\n${OPERATIONS.length} documents; ${failed} failed schema validation`
	)
	if (failed > 0) process.exit(1)
}

main().catch((e: unknown) => {
	console.error(e)
	process.exit(1)
})
