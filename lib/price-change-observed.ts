import type { MarketPriceChange } from '@/lib/graphql/operations/market'
import type {
	PriceChangeBoard,
	PriceChangeObservedEvent
} from '@/lib/graphql/operations/price-changes'

export type ObservedPriceChangeState = {
	state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
	observedAt: string | null
	changeDate: string | null
	rises: MarketPriceChange[]
	falls: MarketPriceChange[]
	riseCount: number
	fallCount: number
	eventRevision: string
}

function compareChange(
	left: MarketPriceChange,
	right: MarketPriceChange
): number {
	return (
		Math.abs(right.change) - Math.abs(left.change) ||
		left.player.playerId - right.player.playerId
	)
}

function observedEventOrder(
	event: PriceChangeObservedEvent | null | undefined
): readonly [number, number] | null {
	if (!event) return null
	const deadline = Date.parse(event.deadline)
	const observedAt = Date.parse(event.observedAt)
	if (!Number.isFinite(deadline) || !Number.isFinite(observedAt)) return null
	return [deadline, observedAt]
}

export function isPriceChangeObservedEventAtLeastAsNew(
	next: PriceChangeObservedEvent | null | undefined,
	current: PriceChangeObservedEvent | null | undefined
): boolean {
	const nextOrder = observedEventOrder(next)
	if (!nextOrder) return false
	if (!current) return true
	const currentOrder = observedEventOrder(current)
	if (!currentOrder) return true
	return (
		nextOrder[0] > currentOrder[0] ||
		(nextOrder[0] === currentOrder[0] && nextOrder[1] >= currentOrder[1])
	)
}

/**
 * Map the immutable observed event into the two consumer projections. This is
 * deliberately the only Web mapping point: neither page compares daily
 * market snapshots or derives an event from mutable player prices.
 */
export function mapLatestPriceChangeEvent(
	board: PriceChangeBoard
): ObservedPriceChangeState | null {
	const event = board.latestEvent
	if (!event) return null
	if (event.outcome === 'NO_CHANGE') {
		return {
			state: 'EMPTY',
			observedAt: event.observedAt,
			changeDate: event.changeDate,
			rises: [],
			falls: [],
			riseCount: 0,
			fallCount: 0,
			eventRevision: board.revision
		}
	}
	const rises = event.changes
		.filter(change => change.direction === 'RISE')
		.sort(compareChange)
	const falls = event.changes
		.filter(change => change.direction === 'FALL')
		.sort(compareChange)
	return {
		// The observed event is independently valid evidence. Prediction
		// freshness may be unavailable while this immutable event remains
		// displayable, especially during a delayed durable reconciliation.
		state: 'AVAILABLE',
		observedAt: event.observedAt,
		changeDate: event.changeDate,
		rises,
		falls,
		riseCount: rises.length,
		fallCount: falls.length,
		eventRevision: board.revision
	}
}
