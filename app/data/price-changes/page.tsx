import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PLAYER_VALUES,
	type PlayerValue,
	type PlayerValuesResponse,
} from '@/lib/graphql/operations/prices'
import {
	utcCalendarDateISO,
} from '@/lib/graphql/operations/events'
import PriceChangesClient from './PriceChangesClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Price changes',
	description: 'Track daily FPL price movement and individual player price history.',
}

export default async function PriceChangesPage() {
	let initialPlayerValues: PlayerValue[] | null = null
	let initialError: string | null = null
	try {
		const data = await executePublicServerQuery<PlayerValuesResponse>(
			GET_PLAYER_VALUES,
			{ changeDate: utcCalendarDateISO() },
			{ cache: 'force-cache', next: { revalidate: 3600 } },
		)
		initialPlayerValues = data.playerValues
	} catch (err) {
		console.error('[price-changes] RSC fetch failed:', err)
		initialError = 'Daily price changes are temporarily unavailable.'
	}
	return (
		<PriceChangesClient
			initialPlayerValues={initialPlayerValues}
			initialError={initialError}
		/>
	)
}
