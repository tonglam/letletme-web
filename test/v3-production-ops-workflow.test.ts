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
	it('is callable through the default-branch CI workflow without running normal CI', () => {
		assert.match(workflow, /workflow_call:/)
		assert.match(dispatchBridge, /workflow_dispatch:/)
		assert.match(
			dispatchBridge,
			/verify:\n\s+if: github\.event_name != 'workflow_dispatch'/
		)
		assert.match(
			dispatchBridge,
			/uses: \.\/\.github\/workflows\/v3-production-cutover\.yml/
		)
		for (const input of [
			'operation',
			'sha',
			'v3_cutover_run_id',
			'v3_release_manifest_base64',
			'v3_release_manifest_sha256',
			'v3_cutover_approval'
		]) {
			assert.match(dispatchBridge, new RegExp(`${input}: \\$\\{\\{ inputs\\.${input} \\}\\}`))
		}
		assert.match(dispatchBridge, /secrets: inherit/)
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

	it('gates the exact Web SHA before migration, provisioning, and runtime verification', () => {
		const activation = job('activate_database', 'status')
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

	it('keeps Vercel deployment and legacy cleanup outside the database operator', () => {
		assert.doesNotMatch(workflow, /APPROVE_V3_LEGACY_DROP/)
		assert.doesNotMatch(workflow, /v3-cleanup|legacy-drop/)
		assert.doesNotMatch(workflow, /vercel deploy|vercel promote|vercel env/)
	})
})
