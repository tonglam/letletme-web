import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PLAYER_VALUES,
	type PlayerValuesResponse,
} from '@/lib/graphql/operations/prices'
import {
	utcCalendarDateISO,
} from '@/lib/graphql/operations/events'
import {
	PriceChangesSectionClient,
	type PriceChange,
} from './PriceChangesSectionClient'

export function PriceChangesSectionFallback() {
	return (
		<section className="py-10">
			<div className="mx-auto max-w-4xl px-4">
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
			</div>
		</section>
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
	let hasError = false

	try {
		const data = await executePublicServerQuery<PlayerValuesResponse>(
			GET_PLAYER_VALUES,
			{ changeDate: utcCalendarDateISO() },
			{ cache: 'force-cache', next: { revalidate: 300 }, timeoutMs: 5_000 },
		)

		// Rows without a previous price (lastValue = 0) are season-baseline
		// imports, not market movement — never render them as rises/falls.
		const changes = data.playerValues.filter(p => p.lastValue > 0)
		priceRises = changes
			.filter(p => p.value > p.lastValue)
			.sort((a, b) => b.value - a.value)
			.map(toChange)
		priceFalls = changes
			.filter(p => p.value < p.lastValue)
			.sort((a, b) => a.value - b.value)
			.map(toChange)
	} catch (err) {
		console.error('Failed to fetch player values:', err)
		hasError = true
	}

	// Pre-season (prices locked) and no-change days: hide the section entirely.
	if (priceRises.length === 0 && priceFalls.length === 0) {
		return null
	}

	return (
		<section className="py-10">
			<div className="mx-auto max-w-4xl px-4">
				<PriceChangesSectionClient
					priceRises={priceRises}
					priceFalls={priceFalls}
					hasError={hasError}
				/>
			</div>
		</section>
	)
}
