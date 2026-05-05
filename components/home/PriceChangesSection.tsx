import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_VALUES,
	utcCalendarDateISO,
	type PlayerValuesResponse,
} from '@/lib/graphql/queries'
import {
	PriceChangesSectionClient,
	type PriceChange,
} from './PriceChangesSectionClient'

export function PriceChangesSectionFallback() {
	return (
		<Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
			<div className="grid md:grid-cols-2 gap-6">
				{[0, 1].map(i => (
					<div key={i}>
						<Skeleton className="h-6 w-32 mb-6" />
						<div className="space-y-2">
							{[1, 2, 3, 4, 5].map(j => (
								<Skeleton
									key={j}
									className="h-12 w-full"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</Card>
	)
}

const toChange = (p: PlayerValuesResponse['playerValues'][number]): PriceChange => ({
	position: p.position,
	player: p.playerName,
	club: p.teamName,
	price: p.value,
	priceChange: Math.abs(p.value - p.lastValue),
})

export async function PriceChangesSection() {
	let priceRises: PriceChange[] = []
	let priceFalls: PriceChange[] = []
	let error: string | null = null

	try {
		const data = await executeQuery<PlayerValuesResponse>(
			GET_PLAYER_VALUES,
			{ changeDate: utcCalendarDateISO() },
			{ cache: 'force-cache', next: { revalidate: 300 } },
		)

		priceRises = data.playerValues
			.filter(p => p.value > p.lastValue)
			.sort((a, b) => b.value - a.value)
			.map(toChange)
		priceFalls = data.playerValues
			.filter(p => p.value < p.lastValue)
			.sort((a, b) => a.value - b.value)
			.map(toChange)
	} catch (err) {
		console.error('Failed to fetch player values:', err)
		error = 'Failed to load price changes'
	}

	return (
		<PriceChangesSectionClient
			priceRises={priceRises}
			priceFalls={priceFalls}
			error={error}
		/>
	)
}
