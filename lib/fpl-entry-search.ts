import { executeQuery } from '@/lib/graphql-client'
import {
	SEARCH_ENTRIES,
	type EntryNameSearchHit,
	type SearchEntriesResponse,
} from '@/lib/graphql/operations/entries'

export type { EntryNameSearchHit }

export async function searchEntriesByName(
	query: string,
	options?: { signal?: AbortSignal }
): Promise<EntryNameSearchHit[]> {
	const data = await executeQuery<SearchEntriesResponse>(
		SEARCH_ENTRIES,
		{ query, limit: 10 },
		{ signal: options?.signal }
	)
	return Array.isArray(data.searchEntries) ? data.searchEntries : []
}
