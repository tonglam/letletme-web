import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const workflow = readFileSync(
	'.github/workflows/v3-production-cutover.yml',
	'utf8'
)
const dispatchBridge = readFileSync('.github/workflows/ci.yml', 'utf8')

function job(name: string, nextName?: string): string {
	const start = workflow.indexOf(`\n  ${name}:`)
	if (start < 0) throw new Error(`Missing workflow job ${name}`)
	const end = nextName
		? workflow.indexOf(`\n  ${nextName}:`, start + 1)
		: workflow.length
	if (end < 0) throw new Error(`Missing workflow job ${nextName}`)
	return workflow.slice(start, end)
}

describe('Web v3 production cutover workflow', () => {
	it('runs only from the default-branch repository-dispatch definition', () => {
		assert.match(workflow, /repository_dispatch:/)
		assert.match(workflow, /- v3-web-production-cutover/)
		assert.doesNotMatch(workflow, /workflow_dispatch:|workflow_call:/)
		assert.doesNotMatch(dispatchBridge, /workflow_dispatch:/)
		assert.doesNotMatch(dispatchBridge, /secrets: inherit/)
		assert.doesNotMatch(dispatchBridge, /v3_production_cutover:/)
		for (const input of [
			'operation',
			'sha',
			'v3_cutover_run_id',
			'v3_release_manifest_base64',
			'v3_release_manifest_sha256',
			'v3_cutover_approval'
		]) {
			assert.match(
				workflow,
				new RegExp(`github\\.event\\.client_payload\\.${input}`)
			)
		}
	})

	it('keeps preflight read-only and accepts only 0008 as pending', () => {
		const preflight = job('preflight', 'activate_database')
		assert.match(preflight, /pending 0008_web_auth_runtime_role/)
		for (const mutation of [
			'npm run db:migrate\n',
			'db:provision-runtime-login',
			'vercel deploy',
			'vercel env'
		]) {
			assert.doesNotMatch(preflight, new RegExp(mutation))
		}
	})

	it('trusts only protected main before installing or executing candidate code', () => {
		const jobs = [
			job('preflight', 'activate_database'),
			job('activate_database', 'post_activation_migrate'),
			job('post_activation_migrate', 'status'),
			job('status')
		]

		for (const contents of jobs) {
			const checkout = contents.indexOf('actions/checkout@')
			const trustedMain = contents.indexOf(
				'gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"'
			)
			const setupNode = contents.indexOf('actions/setup-node@')
			const install = contents.indexOf('npm ci')
			const productionSecret = contents.indexOf('V3_MIGRATION_DATABASE_URL')

			assert.ok(checkout > 0)
			assert.ok(trustedMain > checkout)
			assert.ok(setupNode > trustedMain)
			assert.ok(install > setupNode)
			assert.ok(productionSecret > install)
			assert.match(contents, /test "\$TARGET_SHA" = "\$main_sha"/)
			assert.match(contents, /test "\$\(git rev-parse HEAD\)" = "\$main_sha"/)
		}

		assert.equal(
			workflow.match(/name: Require exact protected main commit/g)?.length,
			4
		)
	})

	it('gates the exact Web SHA before migration, provisioning, and runtime verification', () => {
		const activation = job('activate_database', 'post_activation_migrate')
		const gate = activation.indexOf('scripts/v3-release-gate.ts')
		const migrationRecheck = activation.indexOf(
			'V3_WEB_ACTIVATION_MIGRATIONS=0008-pending'
		)
		const migrate = activation.indexOf('npm run db:migrate\n')
		const provision = activation.indexOf('npm run db:provision-runtime-login')
		const runtimeUrl = activation.indexOf(
			'url.username = `letletme_web_runtime'
		)
		const contract = activation.indexOf('npm run db:runtime-contract')
		assert.ok(gate > 0)
		assert.ok(migrationRecheck > gate)
		assert.ok(migrate > migrationRecheck)
		assert.ok(provision > migrate)
		assert.ok(runtimeUrl > provision)
		assert.ok(contract > runtimeUrl)
		assert.match(activation, /V3_MIGRATION_DATABASE_URL/)
		assert.match(activation, /V3_WEB_DB_PASSWORD/)
		assert.match(activation, /pending 0008_web_auth_runtime_role/)
		assert.match(activation, /V3_WEB_ACTIVATION_MIGRATIONS=already-applied/)
		assert.match(activation, /actual_manifest_sha/)
		assert.match(activation, /plan_version.*3\.2\.5-r3/)
		assert.match(activation, /\.planVersion = "3\.2\.5"/)
		assert.match(
			activation,
			/V3_WEB_RELEASE_PLAN=3\.2\.5-r3-normalized-to-3\.2\.5/
		)
	})

	it('allows only the reviewed 0009 post-activation migration', () => {
		const migration = job('post_activation_migrate', 'status')
		const status = migration.indexOf('npm run db:migrate:status')
		const activationGate = migration.indexOf(
			'test "$V3_CUTOVER_APPROVAL" = "APPROVE_V3_ACTIVATION $CUTOVER_RUN_ID"'
		)
		const migrate = migration.indexOf('npm run db:migrate\n')
		const graphqlBoundary = migration.indexOf('Verify the GraphQL auth-reader boundary')
		const webBoundary = migration.indexOf('npm run db:runtime-contract')

		assert.match(migration, /operation == 'v3-migrate-database'/)
		assert.match(migration, /pending 0009_graphql_auth_reader/)
		assert.match(migration, /rows\[0\]\.status !== 'activated'/)
		assert.match(migration, /graphql_auth_reader_select/)
		assert.doesNotMatch(migration, /pending 0008_web_auth_runtime_role/)
		assert.ok(activationGate > 0)
		assert.ok(status > activationGate)
		assert.ok(migrate > status)
		assert.ok(graphqlBoundary > migrate)
		assert.ok(webBoundary > graphqlBoundary)
	})

	it('keeps Vercel deployment and legacy cleanup outside the database operator', () => {
		assert.doesNotMatch(workflow, /APPROVE_V3_LEGACY_DROP/)
		assert.doesNotMatch(workflow, /v3-cleanup|legacy-drop/)
		assert.doesNotMatch(workflow, /vercel deploy|vercel promote|vercel env/)
	})
})
