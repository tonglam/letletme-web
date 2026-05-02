/**
 * Prove each exported operation in `lib/graphql/queries.ts` is **accepted by GraphQL.validate**
 * against the deployed schema (introspection). That is “matches the backend schema”, not merely
 * “server returned HTTP 200 once”.
 *
 * Requires introspection enabled on the endpoint (typical for dev / many internal APIs).
 *
 * Endpoint: `GRAPHQL_VERIFY_URL` → `GRAPHQL_ENDPOINT` → `.env.local` → `http://127.0.0.1:4000/graphql`.
 *
 * Usage: `npx tsx scripts/validate-queries-vs-schema.ts`
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import {
	buildClientSchema,
	getIntrospectionQuery,
	GraphQLSchema,
	parse,
	validate,
} from "graphql"
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	GET_ENTRY_TRANSFER_HISTORY,
	GET_ENTRY_TOURNAMENTS,
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
} from "../lib/graphql/queries"

function hydrateGraphQlEnvFromLocalFile(): void {
	const p = path.join(process.cwd(), ".env.local")
	if (!existsSync(p)) return
	const text = readFileSync(p, "utf8")
	for (let line of text.split("\n")) {
		line = line.trimEnd()
		if (line.startsWith("#") || !line.includes("=")) continue
		const ix = line.indexOf("=")
		const key = line.slice(0, ix).trim()
		if (key !== "GRAPHQL_VERIFY_URL" && key !== "GRAPHQL_ENDPOINT") continue
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
	"http://127.0.0.1:4000/graphql"

const OPERATIONS: ReadonlyArray<readonly [string, string]> = [
	["GET_CURRENT_AND_NEXT_EVENTS", GET_CURRENT_AND_NEXT_EVENTS],
	["GET_ENTRY_TOURNAMENTS", GET_ENTRY_TOURNAMENTS],
	["GET_TOURNAMENT_EVENT_RESULTS", GET_TOURNAMENT_EVENT_RESULTS],
	["GET_TOURNAMENT_ENTRY_RANKING_SUMMARY", GET_TOURNAMENT_ENTRY_RANKING_SUMMARY],
	["GET_EVENT_STATS_BY_ID", GET_EVENT_STATS_BY_ID],
	["GET_TOURNAMENT_SELECTION_STATS", GET_TOURNAMENT_SELECTION_STATS],
	["GET_PLAYER_DETAIL", GET_PLAYER_DETAIL],
	["GET_PLAYER_VALUES", GET_PLAYER_VALUES],
	["GET_PLAYERS_FOR_PICKER", GET_PLAYERS_FOR_PICKER],
	["GET_TEAMS_FOR_PICKER", GET_TEAMS_FOR_PICKER],
	["GET_PLAYER_VALUE_HISTORY", GET_PLAYER_VALUE_HISTORY],
	["GET_EVENT_OVERALL_RESULT", GET_EVENT_OVERALL_RESULT],
	["GET_LIVE_SCORES", GET_LIVE_SCORES],
	["GET_TOP_TRANSFERS_IN", GET_TOP_TRANSFERS_IN],
	["GET_TOP_TRANSFERS_OUT", GET_TOP_TRANSFERS_OUT],
	["GET_EVENT_FIXTURES", GET_EVENT_FIXTURES],
	["GET_LIVE_POINTS", GET_LIVE_POINTS],
	["GET_TOURNAMENT_LIVE_POINTS", GET_TOURNAMENT_LIVE_POINTS],
	["GET_ENTRY_EVENT_RESULT", GET_ENTRY_EVENT_RESULT],
	["GET_ENTRY_HISTORY", GET_ENTRY_HISTORY],
	["GET_ENTRY_TRANSFER_HISTORY", GET_ENTRY_TRANSFER_HISTORY],
	["GET_LIVE_MATCHES", GET_LIVE_MATCHES],
	["GET_EVENT_LIVE_EXPLAIN", GET_EVENT_LIVE_EXPLAIN],
	["GET_PLAYER_LIVE", GET_PLAYER_LIVE],
]

async function fetchSchema(endpointUrl: string): Promise<GraphQLSchema> {
	const res = await fetch(endpointUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query: getIntrospectionQuery() }),
		cache: "no-store",
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
			`Introspection: non-JSON from ${endpointUrl} (HTTP ${res.status}). ${raw.slice(0, 300)}`,
		)
	}
	const body = parsed as {
		data?: Record<string, unknown>
		errors?: readonly { message?: string }[]
	}
	if (!res.ok) {
		throw new Error(
			`Introspection HTTP ${res.status}: ${JSON.stringify(body)}`,
		)
	}
	if (body.errors?.length) {
		throw new Error(
			`Introspection rejected: ${body.errors.map((e) => e.message ?? "?").join("; ")}`,
		)
	}
	if (!body.data) {
		throw new Error("Introspection returned no data (is __schema disabled on this server?)")
	}
	return buildClientSchema(body.data as never, { assumeValid: false })
}

async function main(): Promise<void> {
	console.log(`Introspecting schema from ${endpoint}\n`)

	let schema: GraphQLSchema
	try {
		schema = await fetchSchema(endpoint)
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

	console.log(`\n${OPERATIONS.length} documents; ${failed} failed schema validation`)
	if (failed > 0) process.exit(1)
}

main().catch((e: unknown) => {
	console.error(e)
	process.exit(1)
})
