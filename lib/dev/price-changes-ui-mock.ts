/**
 * TEMP data mock for /data/price-changes UI review.
 *
 * Flip `PRICE_CHANGES_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type {
	MarketPlayer,
	MarketPulse,
} from '@/lib/graphql/operations/market'

/** Flip to false (or delete the file) to turn the mock off. */
export const PRICE_CHANGES_UI_MOCK_ENABLED = true

function mp(
	playerId: number,
	webName: string,
	teamId: number,
	teamName: string,
	teamShortName: string,
	position: MarketPlayer['position'],
	price: number,
	selectedByPercent: number,
): MarketPlayer {
	return {
		playerId,
		playerCode: playerId * 10,
		webName,
		teamId,
		teamName,
		teamShortName,
		position,
		price,
		selectedByPercent,
	}
}

const SALAH = mp(351, 'Salah', 14, 'Liverpool', 'LIV', 'MIDFIELDER', 134, 62.1)
const HAALAND = mp(10, 'Haaland', 43, 'Man City', 'MCI', 'FORWARD', 149, 55.0)
const PALMER = mp(131, 'Palmer', 8, 'Chelsea', 'CHE', 'MIDFIELDER', 108, 48.2)
const SAKA = mp(7, 'Saka', 3, 'Arsenal', 'ARS', 'MIDFIELDER', 102, 39.4)
const ISAK = mp(11, 'Isak', 4, 'Newcastle', 'NEW', 'FORWARD', 91, 28.7)
const WATKINS = mp(20, 'Watkins', 7, 'Aston Villa', 'AVL', 'FORWARD', 89, 18.4)
const FODEN = mp(24, 'Foden', 43, 'Man City', 'MCI', 'MIDFIELDER', 92, 25.6)
const GORDON = mp(22, 'Gordon', 4, 'Newcastle', 'NEW', 'MIDFIELDER', 75, 15.2)
const RAYA = mp(1, 'Raya', 3, 'Arsenal', 'ARS', 'GOALKEEPER', 55, 41.0)
const NEW_BOY = mp(99, 'New Signing', 2, 'Aston Villa', 'AVL', 'DEFENDER', 45, 0.4)

export function getPriceChangesUiMockPulse(): MarketPulse {
	return {
		coverage: {
			requestedDays: 14,
			observedDays: 14,
			firstDate: '2026-02-20',
			latestDate: '2026-03-05',
			capturedAt: '2026-03-05T09:40:00.000Z',
			complete: true,
			stale: false,
		},
		mostSelected: [SALAH, HAALAND, PALMER, SAKA, ISAK, RAYA],
		ownershipMovers: {
			risers: [
				{
					player: PALMER,
					previousSelectedByPercent: 42.1,
					selectedByPercent: 48.2,
					change: 6.1,
				},
				{
					player: ISAK,
					previousSelectedByPercent: 24.0,
					selectedByPercent: 28.7,
					change: 4.7,
				},
				{
					player: SAKA,
					previousSelectedByPercent: 36.8,
					selectedByPercent: 39.4,
					change: 2.6,
				},
			],
			fallers: [
				{
					player: WATKINS,
					previousSelectedByPercent: 24.8,
					selectedByPercent: 18.4,
					change: -6.4,
				},
				{
					player: FODEN,
					previousSelectedByPercent: 30.1,
					selectedByPercent: 25.6,
					change: -4.5,
				},
				{
					player: GORDON,
					previousSelectedByPercent: 18.9,
					selectedByPercent: 15.2,
					change: -3.7,
				},
			],
		},
		transferMovers: [
			{
				player: PALMER,
				transfersIn: 892_100,
				transfersOut: 41_200,
				netTransfers: 850_900,
			},
			{
				player: WATKINS,
				transfersIn: 40_200,
				transfersOut: 720_300,
				netTransfers: -680_100,
			},
			{
				player: ISAK,
				transfersIn: 298_600,
				transfersOut: 33_400,
				netTransfers: 265_200,
			},
			{
				player: FODEN,
				transfersIn: 77_000,
				transfersOut: 430_100,
				netTransfers: -353_100,
			},
		],
		availabilityUpdates: [
			{
				player: SAKA,
				status: 'd',
				previousStatus: 'a',
				news: 'Knock — will be assessed closer to kickoff.',
				newsAdded: '2026-03-04T18:00:00Z',
				observedDate: '2026-03-05',
				chanceOfPlayingThisRound: 75,
				chanceOfPlayingNextRound: 100,
			},
			{
				player: GORDON,
				status: 'i',
				previousStatus: 'd',
				news: 'Hamstring strain — expected back after the international break.',
				newsAdded: '2026-03-03T12:00:00Z',
				observedDate: '2026-03-05',
				chanceOfPlayingThisRound: 0,
				chanceOfPlayingNextRound: 25,
			},
		],
		newPlayers: [
			{
				player: NEW_BOY,
				firstObservedDate: '2026-03-02',
			},
		],
		priceChanges: [
			{
				player: PALMER,
				changeDate: '2026-03-05',
				oldPrice: 107,
				newPrice: 108,
				change: 1,
				direction: 'RISE',
			},
			{
				player: ISAK,
				changeDate: '2026-03-05',
				oldPrice: 90,
				newPrice: 91,
				change: 1,
				direction: 'RISE',
			},
			{
				player: WATKINS,
				changeDate: '2026-03-05',
				oldPrice: 90,
				newPrice: 89,
				change: -1,
				direction: 'FALL',
			},
			{
				player: FODEN,
				changeDate: '2026-03-04',
				oldPrice: 93,
				newPrice: 92,
				change: -1,
				direction: 'FALL',
			},
		],
	}
}
