import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('fixtures squad schedule dialog focus contract', () => {
	it('passes the actual player opener to the controlled dialog and restores it', async () => {
		const [desk, pitch] = await Promise.all([
			readFile(
				new URL(
					'../app/data/fixtures/_components/MySquadFdrDesk.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL('../components/squad-pitch/SquadPitch.tsx', import.meta.url),
				'utf8'
			)
		])

		assert.match(
			pitch,
			/onPlayerClick\?: \(playerId: string, opener: HTMLElement\)/
		)
		assert.match(
			pitch,
			/openPlayerDetail = \(event: MouseEvent<HTMLButtonElement>\)[\s\S]*event\.currentTarget/
		)
		assert.match(desk, /selectedPlayerTriggerRef/)
		assert.match(desk, /onCloseAutoFocus=\{event =>/)
		assert.match(desk, /event\.preventDefault\(\)[\s\S]*opener\.focus\(\)/)
	})
})
