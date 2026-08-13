import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	getConfiguredTournamentApiBaseUrl,
	getConfiguredTournamentApiKey
} from '../lib/tournament/backend-config'

describe('tournament backend configuration', () => {
	it('uses the legacy settings when canonical names are absent', () => {
		const env = {
			TOURNAMENT_API_BASE_URL: 'https://legacy.example.test/',
			TOURNAMENT_API_KEY: 'legacy-key'
		}

		assert.equal(getConfiguredTournamentApiBaseUrl(env), 'https://legacy.example.test/')
		assert.equal(getConfiguredTournamentApiKey(env), 'legacy-key')
	})

	it('prefers canonical settings when both configurations are present', () => {
		const env = {
			LETLETME_DATA_URL: ' https://data.example.test ',
			TOURNAMENT_API_BASE_URL: 'https://legacy.example.test',
			LETLETME_DATA_API_KEY: ' data-key ',
			TOURNAMENT_API_KEY: 'legacy-key'
		}

		assert.equal(getConfiguredTournamentApiBaseUrl(env), 'https://data.example.test')
		assert.equal(getConfiguredTournamentApiKey(env), 'data-key')
	})

	it('returns empty settings when neither configuration exists', () => {
		assert.equal(getConfiguredTournamentApiBaseUrl({}), '')
		assert.equal(getConfiguredTournamentApiKey({}), '')
	})
})
