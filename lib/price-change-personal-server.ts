import 'server-only'

import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery, executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_MY_FPL_MANAGER_REVIEW,
	type MyFplManagerReviewResponse,
} from '@/lib/graphql/operations/my-fpl'
import {
	GET_PLAYER_START_PRICE,
	type PlayerStartPriceResponse,
} from '@/lib/graphql/operations/players'
import {
	buildPersonalPurchasePrices,
	type PersonalPriceContext,
	type SquadStartPrice,
} from '@/lib/price-change-personal'
import type { Session } from '@/lib/auth'
import type { SquadPickSeed } from '@/lib/squad-picks'

type PriceStartEvent = {
	elementId: number
	eventId: number
}

function uniqueElementIds(picks: readonly SquadPickSeed[]): number[] {
	return Array.from(
		new Set(
			picks
				.map(pick => pick.elementId)
				.filter(
					(elementId): elementId is number =>
						typeof elementId === 'number' &&
						Number.isSafeInteger(elementId) &&
						elementId > 0,
				),
		),
	)
}

async function loadStartPrice({ elementId, eventId }: PriceStartEvent): Promise<SquadStartPrice> {
	try {
		const response = await executePublicServerQuery<PlayerStartPriceResponse>(
			'player-stats',
			GET_PLAYER_START_PRICE,
			{ playerId: elementId, eventId },
			publicFetchOptions({
				revalidate: RevalidateSeconds.publicStats,
				tags: [CacheTag.market],
			}),
		)
		const startPrice = response.playerDetail?.startPrice
		return {
			elementId,
			startPrice:
				typeof startPrice === 'number' && Number.isFinite(startPrice)
					? startPrice
					: null,
		}
	} catch (error) {
		console.warn('[price-changes] player start price failed:', {
			elementId,
			error,
		})
		return { elementId, startPrice: null }
	}
}

export async function loadPersonalPriceContext(params: {
	session: Session
	picks: SquadPickSeed[]
	eventId: number | null
}): Promise<PersonalPriceContext> {
	const elementIds = uniqueElementIds(params.picks)
	if (elementIds.length === 0) {
		return { state: 'UNAVAILABLE', purchasePrices: {} }
	}

	const reviewPromise = executeServerQueryWithSession<MyFplManagerReviewResponse>(
		params.session,
		GET_MY_FPL_MANAGER_REVIEW,
		undefined,
		{ cache: 'no-store' },
	).catch(error => {
		console.warn('[price-changes] manager review failed:', error)
		return null
	})

	const startPricesPromise = params.eventId == null
		? Promise.resolve<SquadStartPrice[]>(
			elementIds.map(elementId => ({ elementId, startPrice: null })),
		)
		: Promise.all(
			elementIds.map(elementId =>
				loadStartPrice({ elementId, eventId: params.eventId as number }),
			),
		)

	const [reviewResponse, startPrices] = await Promise.all([
		reviewPromise,
		startPricesPromise,
	])
	const review = reviewResponse?.myFplManagerReview ?? null

	const personalPrices = buildPersonalPurchasePrices({
		picks: params.picks,
		startPrices,
		review,
	})
	const transferState = review?.state
	if (
		review == null ||
		transferState === 'PENDING' ||
		transferState === 'UNAVAILABLE'
	) {
		return {
			state: 'UNAVAILABLE',
			purchasePrices: {},
		}
	}
	return personalPrices
}
