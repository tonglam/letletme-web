import { createHash } from 'node:crypto'

import postgres from 'postgres'

import {
	fingerprintAuthDataManifest,
	loadAuthDataManifest
} from './auth-data-contract'
import {
	fingerprintAuthContract,
	loadAuthSchemaContract
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

// Frozen from the verified production backup after removing retired Auth tables.
export const EXPECTED_PRODUCTION_AUTH_DATA_FINGERPRINT = [
	'4229f3a55b2cb833',
	'37548af6cfa043f0',
	'dc3ba6a7087f565d',
	'e97f56a47398bb86'
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
	dataFingerprint: string
}

export const PRODUCTION_AUTH_BASELINE_EXPECTATIONS: AuthBaselineAdoptionExpectations = {
	ledgerFingerprint: EXPECTED_LEDGER_FINGERPRINT,
	schemaFingerprint: EXPECTED_AUTH_SCHEMA_FINGERPRINT,
	dataFingerprint: EXPECTED_PRODUCTION_AUTH_DATA_FINGERPRINT
}

function normalizeLedger(rows: readonly LedgerRow[]): NormalizedLedgerRow[] {
	return rows.map(row => {
		if (row.created_at === null || !Number.isSafeInteger(Number(row.created_at))) {
			throw new Error('Production Web migration ledger contains an invalid timestamp')
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
	expectations: AuthBaselineAdoptionExpectations =
		PRODUCTION_AUTH_BASELINE_EXPECTATIONS
): Promise<void> {
	if (expectations.dataFingerprint === 'PENDING_CANONICAL_ACTIVATION') {
		throw new Error('Production Auth data fingerprint has not been frozen')
	}

	const ledgerBefore = await loadLedger(transaction)
	assertExpectedProductionLedger(
		ledgerBefore,
		expectations.ledgerFingerprint
	)

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
	if (dataBefore !== expectations.dataFingerprint) {
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
		throw new Error('Canonical Auth baseline ledger did not converge to one row')
	}

	const schemaAfter = fingerprintAuthContract(
		await loadAuthSchemaContract(transaction)
	)
	if (schemaAfter !== schemaBefore) {
		throw new Error('Auth schema changed while adopting the canonical baseline ledger')
	}

	const dataAfter = fingerprintAuthDataManifest(
		await loadAuthDataManifest(transaction)
	)
	if (dataAfter !== dataBefore) {
		throw new Error('Auth business data changed during baseline adoption')
	}
}
