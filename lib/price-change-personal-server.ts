import 'server-only'

import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery, executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_ENTRY_HISTORY,
	type EntryHistoryResponse,
} from '@/lib/graphql/operations/entries'
import {
	GET_MY_FPL_TEAM_TRANSFERS,
	type MyFplTeamTransfersResponse,
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
	return Array.from(new Set(
		picks
			.map(pick => pick.elementId)
			.filter((elementId): elementId is number =>
				typeof elementId === 'number' && Number.isSafeInteger(elementId) && elementId > 0,
			),
	))
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
		entryId: number
		picks: SquadPickSeed[]
		eventId: number | null
}): Promise<PersonalPriceContext> {
	const elementIds = uniqueElementIds(params.picks)
	if (elementIds.length === 0) {
		return { state: 'UNAVAILABLE', purchasePrices: {} }
	}

	const transfersPromise = executeServerQueryWithSession<MyFplTeamTransfersResponse>(
		params.session,
		GET_MY_FPL_TEAM_TRANSFERS,
		undefined,
		{ cache: 'no-store' },
	).catch(error => {
		console.warn('[price-changes] personal transfer history failed:', error)
		return null
	})

	const historyPromise = executeServerQueryWithSession<EntryHistoryResponse>(
		params.session,
		GET_ENTRY_HISTORY,
		{ entryId: params.entryId },
		{ cache: 'no-store' },
	).catch(error => {
		console.warn('[price-changes] entry history for price rules failed:', error)
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

	const [transfersResponse, historyResponse, startPrices] = await Promise.all([
		transfersPromise,
		historyPromise,
		startPricesPromise,
	])

	const historyChips = new Map<number, string>()
	for (const row of historyResponse?.entryHistory?.results ?? []) {
		if (Number.isSafeInteger(row.eventId) && row.eventId > 0) {
			historyChips.set(row.eventId, row.eventChip)
		}
	}

	const personalPrices = buildPersonalPurchasePrices({
		picks: params.picks,
		startPrices,
		transfers: transfersResponse?.myFplTeamTransfers ?? null,
		historyChips,
	})
	const transferState = transfersResponse?.myFplTeamTransfers?.state
	if (
		transfersResponse == null ||
		transferState === 'PENDING' ||
		transferState === 'UNAVAILABLE'
	) {
		return {
			state: 'UNAVAILABLE',
			purchasePrices: {},
		}
	}
	if (historyResponse == null && personalPrices.state === 'READY') {
		return { ...personalPrices, state: 'PARTIAL' }
	}
	return personalPrices
}
