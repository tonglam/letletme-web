import { executeQuery } from '@/lib/graphql-client'
import type { PlayerMeta } from './tournament-stats-model'

export async function fetchPlayerMetaByIds(ids: number[]): Promise<Record<number, PlayerMeta>> {
	const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
	if (uniqueIds.length === 0) return {}

	const selection = uniqueIds
		.map((id) => `p${id}: player(id: ${id}) { webName team { shortName name } }`)
		.join('\n')
	const query = `query GetTournamentCaptainMeta {\n${selection}\n}`
	const data = await executeQuery<
		Record<
			string,
			| { webName?: string | null; team?: { shortName?: string | null; name?: string | null } | null }
			| null
		>
	>(query)

	const result: Record<number, PlayerMeta> = {}
	for (const id of uniqueIds) {
		const value = data[`p${id}`]
		if (typeof value?.webName === 'string' && value.webName.length > 0) {
			result[id] = {
				webName: value.webName,
				teamShortName: value.team?.shortName ?? value.team?.name ?? 'N/A',
			}
		}
	}
	return result
}
