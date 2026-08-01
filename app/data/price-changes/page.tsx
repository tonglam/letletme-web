import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PLAYER_VALUES,
	utcCalendarDateISO,
	type PlayerValue,
	type PlayerValuesResponse,
} from '@/lib/graphql/queries'
import PriceChangesClient from './PriceChangesClient'

export default async function PriceChangesPage() {
	let initialPlayerValues: PlayerValue[] | null = null
	try {
		const data = await executePublicServerQuery<PlayerValuesResponse>(
			GET_PLAYER_VALUES,
			{ changeDate: utcCalendarDateISO() },
			{ cache: 'force-cache', next: { revalidate: 3600 } },
		)
		initialPlayerValues = data.playerValues
	} catch (err) {
		console.error('[price-changes] RSC fetch failed:', err)
	}
	return <PriceChangesClient initialPlayerValues={initialPlayerValues} />
}
