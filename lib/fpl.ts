interface FplEntryApiResponse {
	id: number
	player_first_name: string
	player_last_name: string
	name: string
}

export interface FplEntryInfo {
	teamName: string
	managerName: string
}

export async function validateFplEntry(
	entryId: number,
): Promise<{ valid: boolean; teamName?: string; managerName?: string }> {
	try {
		const res = await fetch(
			`https://fantasy.premierleague.com/api/entry/${entryId}/`,
			{ cache: 'no-store' },
		)
		if (!res.ok) return { valid: false }
		const data: FplEntryApiResponse = await res.json()
		return {
			valid: true,
			teamName: data.name,
			managerName: `${data.player_first_name} ${data.player_last_name}`,
		}
	} catch {
		return { valid: false }
	}
}
