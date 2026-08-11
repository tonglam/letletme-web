import { createHash } from 'node:crypto'

import postgres from 'postgres'

import {
	fingerprintAuthDataManifest,
	loadAuthDataManifest
} from './auth-data-contract'
import {
	fingerprintAuthContract,
	loadAuthSchemaContract,
	assertAuthCapabilityMemberships
} from './auth-schema-contract'

const EXPECTED_LEDGER_COUNT = 11
const EXPECTED_LEDGER_FIRST = 1777262481279
const EXPECTED_LEDGER_LAST = 1786435200000
const EXPECTED_LEDGER_FINGERPRINT =
	'2392391edcfd9cad034baa03780d07298e4c6500fa63823e7fcb751526f9793d'

export const EXPECTED_AUTH_SCHEMA_FINGERPRINT = [
	'6ba26d727b3ea59b',
	'eb24999839efe6be',
	'18c1061931aec753',
	'583c34744cff92c1'
].join('')

type QueryClient = postgres.Sql | postgres.TransactionSql

type LedgerRow = {
	hash: string
	created_at: string | null
}

type NormalizedLedgerRow = {
	hash: string
	createdAt: number
}

export type AuthBaselineAdoptionExpectations = {
	ledgerFingerprint: string
	schemaFingerprint: string
	dataFingerprint?: string
}

export const PRODUCTION_AUTH_BASELINE_EXPECTATIONS: AuthBaselineAdoptionExpectations =
	{
		ledgerFingerprint: EXPECTED_LEDGER_FINGERPRINT,
		schemaFingerprint: EXPECTED_AUTH_SCHEMA_FINGERPRINT
	}

function normalizeLedger(rows: readonly LedgerRow[]): NormalizedLedgerRow[] {
	return rows.map(row => {
		if (
			row.created_at === null ||
			!Number.isSafeInteger(Number(row.created_at))
		) {
			throw new Error(
				'Production Web migration ledger contains an invalid timestamp'
			)
		}
		return { hash: row.hash, createdAt: Number(row.created_at) }
	})
}

function fingerprintLedger(rows: readonly NormalizedLedgerRow[]): string {
	return createHash('sha256').update(JSON.stringify(rows), 'utf8').digest('hex')
}

async function loadLedger(client: QueryClient): Promise<LedgerRow[]> {
	return client<LedgerRow[]>`
		SELECT hash, created_at::text
		FROM bauth.__drizzle_migrations
		ORDER BY created_at, id
	`
}

async function removeRetiredAuthObjects(
	transaction: postgres.TransactionSql
): Promise<void> {
	const [legacy] = await transaction<
		{
			api_key_exists: boolean
			jwk_exists: boolean
			rate_limit_exists: boolean
			shared_ledger_exists: boolean
			shared_schema_exists: boolean
		}[]
	>`
		SELECT
			to_regclass('bauth.apikey') IS NOT NULL AS api_key_exists,
			to_regclass('bauth.jwks') IS NOT NULL AS jwk_exists,
			to_regclass('bauth.rate_limit') IS NOT NULL AS rate_limit_exists,
			to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS shared_ledger_exists,
			to_regnamespace('drizzle') IS NOT NULL AS shared_schema_exists
	`
	if (!legacy) throw new Error('Failed to inspect retired Auth objects')

	if (legacy.api_key_exists) {
		await transaction`LOCK TABLE bauth.apikey IN ACCESS EXCLUSIVE MODE`
		const [{ count }] = await transaction<{ count: string }[]>`
			SELECT count(*)::text AS count FROM bauth.apikey
		`
		if (count !== '0') {
			throw new Error(
				`Retired bauth.apikey must be empty before baseline adoption (found ${count} rows)`
			)
		}
	}
	if (legacy.jwk_exists)
		await transaction`LOCK TABLE bauth.jwks IN ACCESS EXCLUSIVE MODE`
	if (legacy.rate_limit_exists)
		await transaction`LOCK TABLE bauth.rate_limit IN ACCESS EXCLUSIVE MODE`
	if (legacy.shared_ledger_exists)
		await transaction`LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE`

	await transaction`DROP TABLE IF EXISTS bauth.apikey RESTRICT`
	await transaction`DROP TABLE IF EXISTS bauth.jwks RESTRICT`
	await transaction`DROP TABLE IF EXISTS bauth.rate_limit RESTRICT`
	await transaction`DROP TABLE IF EXISTS drizzle.__drizzle_migrations RESTRICT`
	if (legacy.shared_schema_exists)
		await transaction`DROP SCHEMA drizzle RESTRICT`
}

function assertExpectedProductionLedger(
	rows: readonly LedgerRow[],
	expectedFingerprint: string
): void {
	const normalized = normalizeLedger(rows)
	if (
		normalized.length !== EXPECTED_LEDGER_COUNT ||
		normalized[0]?.createdAt !== EXPECTED_LEDGER_FIRST ||
		normalized.at(-1)?.createdAt !== EXPECTED_LEDGER_LAST ||
		fingerprintLedger(normalized) !== expectedFingerprint
	) {
		throw new Error(
			'Production Web migration ledger does not match the accepted canonical boundary'
		)
	}
}

export async function adoptProductionAuthBaseline(
	transaction: postgres.TransactionSql,
	baselineHash: string,
	baselineTimestamp: number,
	expectations: AuthBaselineAdoptionExpectations = PRODUCTION_AUTH_BASELINE_EXPECTATIONS
): Promise<void> {
	const ledgerBefore = await loadLedger(transaction)
	assertExpectedProductionLedger(ledgerBefore, expectations.ledgerFingerprint)
	await assertAuthCapabilityMemberships(transaction)
	await removeRetiredAuthObjects(transaction)

	const schemaBefore = fingerprintAuthContract(
		await loadAuthSchemaContract(transaction)
	)
	if (schemaBefore !== expectations.schemaFingerprint) {
		throw new Error(
			`Auth schema fingerprint mismatch: expected=${expectations.schemaFingerprint} actual=${schemaBefore}`
		)
	}

	const dataBefore = fingerprintAuthDataManifest(
		await loadAuthDataManifest(transaction)
	)
	if (
		expectations.dataFingerprint !== undefined &&
		dataBefore !== expectations.dataFingerprint
	) {
		throw new Error(
			`Auth data fingerprint mismatch: expected=${expectations.dataFingerprint} actual=${dataBefore}`
		)
	}

	await transaction`TRUNCATE TABLE bauth.__drizzle_migrations RESTART IDENTITY`
	await transaction`
		INSERT INTO bauth.__drizzle_migrations (hash, created_at)
		VALUES (${baselineHash}, ${baselineTimestamp})
	`

	const [ledgerAfter] = await transaction<
		{ id: number; hash: string; created_at: string | null }[]
	>`
		SELECT id, hash, created_at::text
		FROM bauth.__drizzle_migrations
	`
	if (
		!ledgerAfter ||
		ledgerAfter.id !== 1 ||
		ledgerAfter.hash !== baselineHash ||
		Number(ledgerAfter.created_at) !== baselineTimestamp
	) {
		throw new Error(
			'Canonical Auth baseline ledger did not converge to one row'
		)
	}

	const schemaAfter = fingerprintAuthContract(
		await loadAuthSchemaContract(transaction)
	)
	if (schemaAfter !== schemaBefore) {
		throw new Error(
			'Auth schema changed while adopting the canonical baseline ledger'
		)
	}

	const dataAfter = fingerprintAuthDataManifest(
		await loadAuthDataManifest(transaction)
	)
	if (dataAfter !== dataBefore) {
		throw new Error('Auth business data changed during baseline adoption')
	}
}
