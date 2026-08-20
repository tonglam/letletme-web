import 'server-only'

import { squadMatchKey } from '@/lib/fixtures-fdr'
import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PLAYERS_FOR_PICKER,
	type PlayersForPickerResponse,
} from '@/lib/graphql/operations/players'
import type { SquadPickSeed } from '@/lib/squad-picks'

const PICKER_PAGE_SIZE = 200
const PICKER_MAX_PAGES = 20

/**
 * Build webName|teamShortName → FPL element id for squad matching.
 * Used when entry picks omit the `element` field.
 */
export async function buildPlayerIdBySquadKey(): Promise<Map<string, number>> {
	const map = new Map<string, number>()

	for (let page = 0; page < PICKER_MAX_PAGES; page += 1) {
		const offset = page * PICKER_PAGE_SIZE
		const response = await executePublicServerQuery<PlayersForPickerResponse>(
			'player-stats',
			GET_PLAYERS_FOR_PICKER,
			{ filter: {}, limit: PICKER_PAGE_SIZE, offset },
			publicFetchOptions({
				revalidate: RevalidateSeconds.publicStats,
				tags: [CacheTag.fixtures],
			}),
		)

		const batch = response.players ?? []
		if (batch.length === 0) break

		for (const player of batch) {
			map.set(squadMatchKey(player.webName, player.team.shortName), player.id)
		}

		if (batch.length < PICKER_PAGE_SIZE) break
	}

	return map
}

export function fillMissingSquadElementIds(
	picks: SquadPickSeed[],
	idByKey: Map<string, number>,
): SquadPickSeed[] {
	return picks.map(pick => {
		if (pick.elementId != null) return pick
		const key = squadMatchKey(pick.webName, pick.teamShortName)
		const id = idByKey.get(key)
		if (id == null) return pick
		return { ...pick, elementId: id }
	})
}

export async function resolveSquadPickElementIds(
	picks: SquadPickSeed[],
): Promise<SquadPickSeed[]> {
	const missing = picks.some(p => p.elementId == null)
	if (!missing) return picks
	const idByKey = await buildPlayerIdBySquadKey()
	return fillMissingSquadElementIds(picks, idByKey)
}
