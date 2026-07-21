import { z } from 'zod'

const FplEntryApiResponseSchema = z.object({
	id: z.number().int().positive(),
	player_first_name: z.string(),
	player_last_name: z.string(),
	name: z.string().min(1),
})

const FPL_ENTRY_TIMEOUT_MS = 10_000

export interface FplEntryInfo {
	teamName: string
	managerName: string
}

export async function validateFplEntry(
	entryId: number,
): Promise<{ valid: boolean; teamName?: string; managerName?: string }> {
	if (!Number.isSafeInteger(entryId) || entryId <= 0) return { valid: false }
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), FPL_ENTRY_TIMEOUT_MS)
	try {
		const res = await fetch(
			`https://fantasy.premierleague.com/api/entry/${entryId}/`,
			{ cache: 'no-store', signal: controller.signal },
		)
		if (!res.ok) return { valid: false }
		const parsed = FplEntryApiResponseSchema.safeParse(await res.json())
		if (!parsed.success || parsed.data.id !== entryId) return { valid: false }
		const data = parsed.data
		return {
			valid: true,
			teamName: data.name,
			managerName: `${data.player_first_name} ${data.player_last_name}`,
		}
	} catch {
		return { valid: false }
	} finally {
		clearTimeout(timeoutId)
	}
}
