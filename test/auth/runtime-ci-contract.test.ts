import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')

describe('Web runtime CI contract', () => {
	it('starts production E2E with the restricted Web runtime login', () => {
		assert.match(
			workflow,
			/name: Production E2E[\s\S]*?env:\s*\n\s*DATABASE_URL: \$\{\{ env\.WEB_RUNTIME_DATABASE_URL \}\}/
		)
	})
})
