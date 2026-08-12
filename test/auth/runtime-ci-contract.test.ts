import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const migrateWorkflow = readFileSync(
	'.github/workflows/database-migrate.yml',
	'utf8'
)

describe('Web runtime CI contract', () => {
	it('starts production E2E with the restricted Web runtime login', () => {
		assert.match(
			workflow,
			/name: Production E2E[\s\S]*?env:\s*\n\s*DATABASE_URL: \$\{\{ env\.WEB_RUNTIME_DATABASE_URL \}\}/
		)
	})

	it('bootstraps idempotently and proves the password hash is unchanged', () => {
		assert.match(workflow, /npm run db:bootstrap-runtime-login/g)
		assert.match(workflow, /password_hash_before=/)
		assert.match(workflow, /password_hash_after=/)
		assert.match(workflow, /db:verify-runtime-login/)
		assert.doesNotMatch(workflow, /WEB_RUNTIME_DB_PASSWORD/)
	})

	it('migration workflow performs a read-only verifier without a password secret', () => {
		assert.match(migrateWorkflow, /npm run db:verify-runtime-login/)
		assert.doesNotMatch(migrateWorkflow, /bootstrap-runtime-login/)
		assert.doesNotMatch(migrateWorkflow, /WEB_RUNTIME_DB_PASSWORD/)
	})
})
