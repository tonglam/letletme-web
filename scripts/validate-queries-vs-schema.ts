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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
	buildClientSchema,
	buildSchema,
	getIntrospectionQuery,
	GraphQLSchema,
	Kind,
	parse,
	validate,
	visit
} from 'graphql'
import type { SelectionSetNode } from 'graphql'
import { buildFixtureWindowQuery } from '../lib/fixture-window'
import {
	GET_ENTRY,
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
	GET_LIVE_MATCHDAY,
	GET_LIVE_MATCHDAY_HEAD,
	GET_LIVE_MATCHDAY_FIXTURE_SUMMARY,
	GET_GAMEWEEK_BOARDS,
	GET_LIVE_POINTS,
	GET_LIVE_SCORES,
	GET_LIVE_CONTEXT,
	GET_PLAYER_LIVE
} from '../lib/graphql/operations/live'
import { GET_GAMEWEEK_DESK } from '../lib/graphql/operations/gameweek'
import {
	GET_FIXTURE_PLANNING_SIGNALS,
	GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK,
	GET_MARKET_AVAILABILITY,
	GET_MARKET_PULSE,
	GET_MARKET_OWNERSHIP_DAY,
	GET_MARKET_OWNERSHIP_OVERVIEW
} from '../lib/graphql/operations/market'
import {
	GET_HOME_GAMEWEEK,
	GET_HOME_PERSONAL_DESK,
	GET_HOME_MARKET_DESK,
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
	GET_PRICE_CHANGE_BOARD,
	GET_PRICE_CHANGE_LIVE_BOARD,
	GET_PRICE_CHANGE_LIVE_CURSOR
} from '../lib/graphql/operations/price-changes'
import {
	GET_MY_FPL_MANAGER_GAMEWEEK,
	GET_MY_FPL_MANAGER_REVIEW,
	GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
	GET_MY_TOURNAMENT_REVIEW_CATALOG,
	GET_MY_TOURNAMENT_REVIEW_STATUS,
	GET_MY_TOURNAMENT_SEASON_REVIEW,
	GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION
} from '../lib/graphql/operations/my-fpl'
import {
	GET_ENTRY_LIVE_COMPETITION_BOARD,
	GET_ENTRY_TOURNAMENTS,
	GET_PLATFORM_ADMIN_TOURNAMENTS,
	GET_LEAGUE_LIVE_HEAD,
	GET_MANAGED_TOURNAMENT,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	GET_TOURNAMENT_EVENT_RESULTS,
	GET_TOURNAMENT_DETAIL_DESK,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_OFFICIAL_H2H,
	GET_TOURNAMENT_OFFICIAL_H2H_HISTORY,
	GET_TOURNAMENT_PARTICIPANTS,
	GET_TOURNAMENT_ENTRY_SQUADS,
	GET_TOURNAMENT_SELECTION_INDEX,
	GET_TOURNAMENT_SELECTION_STATS
} from '../lib/graphql/operations/tournaments'
import {
	GET_TREND_COHORT_SNAPSHOT,
	GET_TREND_COHORTS
} from '../lib/graphql/operations/trends'
import { AGENT_GRAPHQL_DOCUMENTS } from '../lib/agent-tools/documents'
import {
	LIVE_MATCHES_CONTRACT_VERSION,
	LIVE_POINTS_CONTRACT_VERSION,
	liveContractVersionForQuery
} from '../lib/graphql-client'

function hydrateGraphQlEnvFromLocalFile(): void {
	for (const filename of ['.env.e2e.local', '.env.local']) {
		const p = path.join(process.cwd(), filename)
		if (!existsSync(p)) continue
		const text = readFileSync(p, 'utf8')
		for (let line of text.split('\n')) {
			line = line.trimEnd()
			if (line.startsWith('#') || !line.includes('=')) continue
			const ix = line.indexOf('=')
			const key = line.slice(0, ix).trim()
			if (
				key !== 'GRAPHQL_VERIFY_URL' &&
				key !== 'GRAPHQL_ENDPOINT' &&
				key !== 'GRAPHQL_SERVICE_TOKEN' &&
				key !== 'GRAPHQL_SCHEMA_MODULE'
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
}

hydrateGraphQlEnvFromLocalFile()

const endpoint =
	process.env.GRAPHQL_VERIFY_URL ??
	process.env.GRAPHQL_ENDPOINT ??
	'http://127.0.0.1:4000/graphql'

const OPERATIONS: ReadonlyArray<readonly [string, string]> = [
	['GET_ENTRY', GET_ENTRY],
	['GET_CURRENT_AND_NEXT_EVENTS', GET_CURRENT_AND_NEXT_EVENTS],
	['GET_CORE_EVENT_CONTEXT', GET_CORE_EVENT_CONTEXT],
	['GET_PLAYER_STATS_BOOTSTRAP', GET_PLAYER_STATS_BOOTSTRAP],
	['GET_PLAYER_STATS_DESK_OVERVIEW', GET_PLAYER_STATS_DESK_OVERVIEW],
	['GET_PLAYER_STATS_DESK_CONTEXT', GET_PLAYER_STATS_DESK_CONTEXT],
	['GET_PLAYER_STATS_DESK_RECENT', GET_PLAYER_STATS_DESK_RECENT],
	['GET_PLAYER_STATS_DESK_PRODUCTION', GET_PLAYER_STATS_DESK_PRODUCTION],
	['GET_PLAYER_STATS_DESK_PROCESS', GET_PLAYER_STATS_DESK_PROCESS],
	['GET_ENTRY_TOURNAMENTS', GET_ENTRY_TOURNAMENTS],
	['GET_PLATFORM_ADMIN_TOURNAMENTS', GET_PLATFORM_ADMIN_TOURNAMENTS],
	['GET_LEAGUE_LIVE_HEAD', GET_LEAGUE_LIVE_HEAD],
	['GET_ENTRY_LIVE_COMPETITION_BOARD', GET_ENTRY_LIVE_COMPETITION_BOARD],
	['GET_TOURNAMENT_EVENT_RESULTS', GET_TOURNAMENT_EVENT_RESULTS],
	[
		'GET_TOURNAMENT_ENTRY_RANKING_SUMMARY',
		GET_TOURNAMENT_ENTRY_RANKING_SUMMARY
	],
	['GET_TOURNAMENT_PARTICIPANTS', GET_TOURNAMENT_PARTICIPANTS],
	['GET_TOURNAMENT_METADATA', GET_TOURNAMENT_METADATA],
	['GET_TOURNAMENT_OFFICIAL_H2H', GET_TOURNAMENT_OFFICIAL_H2H],
	['GET_TOURNAMENT_OFFICIAL_H2H_HISTORY', GET_TOURNAMENT_OFFICIAL_H2H_HISTORY],
	['GET_MANAGED_TOURNAMENT', GET_MANAGED_TOURNAMENT],
	['GET_EVENT_STATS_BY_ID', GET_EVENT_STATS_BY_ID],
	['GET_TOURNAMENT_SELECTION_STATS', GET_TOURNAMENT_SELECTION_STATS],
	['GET_TOURNAMENT_SELECTION_INDEX', GET_TOURNAMENT_SELECTION_INDEX],
	['GET_TOURNAMENT_ENTRY_SQUADS', GET_TOURNAMENT_ENTRY_SQUADS],
	['GET_TREND_COHORTS', GET_TREND_COHORTS],
	['GET_TREND_COHORT_SNAPSHOT', GET_TREND_COHORT_SNAPSHOT],
	['GET_PLAYER_DETAIL', GET_PLAYER_DETAIL],
	['GET_PLAYER_STATE_PROFILE', GET_PLAYER_STATE_PROFILE],
	['GET_PLAYER_VALUES', GET_PLAYER_VALUES],
	['GET_HOME_MARKET_PULSE', GET_HOME_MARKET_PULSE],
	['GET_HOME_MARKET_OWNERSHIP', GET_HOME_MARKET_OWNERSHIP],
	['GET_HOME_MARKET_DESK', GET_HOME_MARKET_DESK],
	['GET_HOME_GAMEWEEK', GET_HOME_GAMEWEEK],
	['GET_GAMEWEEK_DESK', GET_GAMEWEEK_DESK],
	['GET_HOME_PERSONAL_DESK', GET_HOME_PERSONAL_DESK],
	['GET_MY_TOURNAMENT_REVIEW_CATALOG', GET_MY_TOURNAMENT_REVIEW_CATALOG],
	['GET_MY_TOURNAMENT_GAMEWEEK_REVIEW', GET_MY_TOURNAMENT_GAMEWEEK_REVIEW],
	['GET_MY_TOURNAMENT_SEASON_REVIEW', GET_MY_TOURNAMENT_SEASON_REVIEW],
	['GET_MY_TOURNAMENT_REVIEW_STATUS', GET_MY_TOURNAMENT_REVIEW_STATUS],
	['GET_MARKET_PULSE', GET_MARKET_PULSE],
	['GET_MARKET_AVAILABILITY', GET_MARKET_AVAILABILITY],
	['GET_MARKET_OWNERSHIP_OVERVIEW', GET_MARKET_OWNERSHIP_OVERVIEW],
	['GET_MARKET_OWNERSHIP_DAY', GET_MARKET_OWNERSHIP_DAY],
	['GET_FIXTURE_PLANNING_SIGNALS', GET_FIXTURE_PLANNING_SIGNALS],
	[
		'GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK',
		GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK
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
	['GET_PRICE_CHANGE_BOARD', GET_PRICE_CHANGE_BOARD],
	['GET_PRICE_CHANGE_LIVE_CURSOR', GET_PRICE_CHANGE_LIVE_CURSOR],
	['GET_PRICE_CHANGE_LIVE_BOARD', GET_PRICE_CHANGE_LIVE_BOARD],
	['GET_EVENT_FIXTURES', GET_EVENT_FIXTURES],
	['GET_FIXTURE_WINDOW_5', buildFixtureWindowQuery(5)],
	['GET_LIVE_POINTS', GET_LIVE_POINTS],
	['GET_GAMEWEEK_BOARDS', GET_GAMEWEEK_BOARDS],
	['GET_TOURNAMENT_DETAIL_DESK', GET_TOURNAMENT_DETAIL_DESK],
	['SEARCH_ENTRIES', SEARCH_ENTRIES],
	['GET_ENTRY_EVENT_RESULT', GET_ENTRY_EVENT_RESULT],
	['GET_ENTRY_HISTORY', GET_ENTRY_HISTORY],
	['GET_ENTRY_TRANSFER_HISTORY', GET_ENTRY_TRANSFER_HISTORY],
	['GET_LIVE_MATCHDAY', GET_LIVE_MATCHDAY],
	['GET_LIVE_MATCHDAY_HEAD', GET_LIVE_MATCHDAY_HEAD],
	['GET_LIVE_MATCHDAY_FIXTURE_SUMMARY', GET_LIVE_MATCHDAY_FIXTURE_SUMMARY],
	['GET_MY_FPL_MANAGER_REVIEW', GET_MY_FPL_MANAGER_REVIEW],
	['GET_MY_FPL_MANAGER_GAMEWEEK', GET_MY_FPL_MANAGER_GAMEWEEK],
	['GET_MY_TOURNAMENT_REVIEW_CATALOG', GET_MY_TOURNAMENT_REVIEW_CATALOG],
	['GET_MY_TOURNAMENT_GAMEWEEK_REVIEW', GET_MY_TOURNAMENT_GAMEWEEK_REVIEW],
	['GET_MY_TOURNAMENT_SEASON_REVIEW', GET_MY_TOURNAMENT_SEASON_REVIEW],
	[
		'GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION',
		GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION
	],
	['GET_MY_TOURNAMENT_REVIEW_STATUS', GET_MY_TOURNAMENT_REVIEW_STATUS],
	['GET_EVENT_LIVE_EXPLAIN', GET_EVENT_LIVE_EXPLAIN],
	['GET_EVENT_LIVE_EXPLAINS', GET_EVENT_LIVE_EXPLAINS],
	['GET_PLAYER_LIVE', GET_PLAYER_LIVE],
	...Object.entries(AGENT_GRAPHQL_DOCUMENTS).map(
		([name, document]) => [`AGENT_${name}`, document] as const
	)
]

type PinnedTransportContracts = {
	requiresLivePointsV2Contract: (rootFields: readonly string[]) => boolean
	requiresLiveMatchesV3Contract: (rootFields: readonly string[]) => boolean
	livePointsValue: string
	liveMatchesValue: string
}

const rootFieldsForDocument = (document: string): string[] => {
	const ast = parse(document)
	const fragments = new Map(
		ast.definitions
			.filter(definition => definition.kind === Kind.FRAGMENT_DEFINITION)
			.map(definition => [definition.name.value, definition] as const)
	)
	const rootFields = new Set<string>()
	const visitedFragments = new Set<string>()

	const collect = (selectionSet: SelectionSetNode): void => {
		for (const selection of selectionSet.selections) {
			if (selection.kind === Kind.FIELD) {
				rootFields.add(selection.name.value)
				continue
			}
			if (selection.kind === Kind.INLINE_FRAGMENT) {
				collect(selection.selectionSet)
				continue
			}
			if (
				selection.kind === Kind.FRAGMENT_SPREAD &&
				!visitedFragments.has(selection.name.value)
			) {
				visitedFragments.add(selection.name.value)
				const fragment = fragments.get(selection.name.value)
				if (fragment) collect(fragment.selectionSet)
			}
		}
	}

	for (const definition of ast.definitions) {
		if (definition.kind === Kind.OPERATION_DEFINITION) {
			collect(definition.selectionSet)
		}
	}
	return Array.from(rootFields)
}

async function loadPinnedTransportContracts(): Promise<PinnedTransportContracts | null> {
	const modulePath = process.env.GRAPHQL_SCHEMA_MODULE?.trim()
	if (!modulePath) return null
	const graphqlRoot = path.resolve(path.dirname(path.resolve(modulePath)), '..', '..')
	const pointsPath = path.join(
		graphqlRoot,
		'src/http/live-points-contract.ts'
	)
	const matchesPath = path.join(
		graphqlRoot,
		'src/http/live-matches-contract.ts'
	)
	if (!existsSync(pointsPath) || !existsSync(matchesPath)) {
		throw new Error(
			`Pinned GraphQL transport contract modules were not found under ${graphqlRoot}`
		)
	}
	const [points, matches] = await Promise.all([
		import(pathToFileURL(pointsPath).href),
		import(pathToFileURL(matchesPath).href)
	])
	if (
		typeof points.requiresLivePointsV2Contract !== 'function' ||
		typeof matches.requiresLiveMatchesV3Contract !== 'function' ||
		typeof points.LIVE_POINTS_CONTRACT_VALUE !== 'string' ||
		typeof matches.LIVE_MATCHES_CONTRACT_VALUE !== 'string'
	) {
		throw new Error('Pinned GraphQL transport contract exports are invalid')
	}
	return {
		requiresLivePointsV2Contract: points.requiresLivePointsV2Contract,
		requiresLiveMatchesV3Contract: matches.requiresLiveMatchesV3Contract,
		livePointsValue: points.LIVE_POINTS_CONTRACT_VALUE,
		liveMatchesValue: matches.LIVE_MATCHES_CONTRACT_VALUE
	}
}

async function discoverVersionGatedOperations(
	contracts: PinnedTransportContracts
): Promise<ReadonlyArray<readonly [string, string]>> {
	const operationsDirectory = path.resolve('lib/graphql/operations')
	const discovered: Array<readonly [string, string]> = []
	for (const filename of readdirSync(operationsDirectory).filter(name =>
		name.endsWith('.ts')
	)) {
		const exports = await import(
			pathToFileURL(path.join(operationsDirectory, filename)).href
		)
		for (const [exportName, value] of Object.entries(exports)) {
			if (typeof value !== 'string') continue
			let rootFields: string[]
			try {
				rootFields = rootFieldsForDocument(value)
			} catch {
				continue
			}
			if (
				contracts.requiresLivePointsV2Contract(rootFields) ||
				contracts.requiresLiveMatchesV3Contract(rootFields)
			) {
				discovered.push([`${filename}:${exportName}`, value])
			}
		}
	}
	return discovered
}

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
	let transportContracts: PinnedTransportContracts | null = null
	try {
		transportContracts = await loadPinnedTransportContracts()
	} catch (e) {
		console.error(e)
		process.exit(1)
	}
	if (transportContracts) {
		if (
			transportContracts.livePointsValue !== LIVE_POINTS_CONTRACT_VERSION ||
			transportContracts.liveMatchesValue !== LIVE_MATCHES_CONTRACT_VERSION
		) {
			console.error('[CONTRACT_FAIL] Client contract tokens differ from GraphQL')
			failed += 1
		}
		const registeredDocuments = new Set(
			OPERATIONS.map(([, document]) => document.trim())
		)
		for (const [name, document] of await discoverVersionGatedOperations(
			transportContracts
		)) {
			if (!registeredDocuments.has(document.trim())) {
				console.error(
					`[REGISTRY_FAIL] ${name} is version-gated but missing from OPERATIONS`
				)
				failed += 1
			}
		}
	} else {
		console.warn(
			'[CONTRACT_SKIP] GRAPHQL_SCHEMA_MODULE is unset; pinned transport parity was not checked'
		)
	}

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
		let operationFailed = false
		if (transportContracts) {
			const rootFields = rootFieldsForDocument(doc)
			const requiresPoints =
				transportContracts.requiresLivePointsV2Contract(rootFields)
			const requiresMatches =
				transportContracts.requiresLiveMatchesV3Contract(rootFields)
			if (requiresPoints && requiresMatches) {
				console.log(
					`[CONTRACT_FAIL] ${name}: mixes Live Points and Live Matches roots`
				)
				operationFailed = true
			} else {
				const expected = requiresPoints
					? transportContracts.livePointsValue
					: requiresMatches
						? transportContracts.liveMatchesValue
						: null
				let actual: string | null = null
				try {
					actual = liveContractVersionForQuery(doc)
				} catch (error) {
					console.log(
						`[CONTRACT_FAIL] ${name}: ${error instanceof Error ? error.message : String(error)}`
					)
					operationFailed = true
				}
				if (!operationFailed && actual !== expected) {
					console.log(
						`[CONTRACT_FAIL] ${name}: expected ${expected ?? 'no contract'}, client selected ${actual ?? 'no contract'}`
					)
					operationFailed = true
				}
			}
		}
		const errs = validate(schema, ast)
		const astNodeLimit =
			name === 'GET_ENTRY_LIVE_COMPETITION_BOARD'
				? 400
				: name === 'GET_LIVE_MATCHDAY' || name === 'GET_LIVE_MATCHDAY_HEAD'
					? 200
					: null
		if (astNodeLimit !== null) {
			let astNodes = 0
			visit(ast, { enter: () => void (astNodes += 1) })
			if (astNodes > astNodeLimit) {
				failed += 1
				console.log(
					`[LIMIT_FAIL] ${name}: ${astNodes} AST nodes exceeds the production limit of ${astNodeLimit}`
				)
				continue
			}
		}
		if (errs.length > 0) {
			operationFailed = true
			console.log(`[SCHEMA_FAIL] ${name}`)
			for (const err of errs) {
				console.log(`  ${err.message}`)
			}
		}
		if (operationFailed) {
			failed += 1
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
