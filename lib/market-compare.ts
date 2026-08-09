import type { FdrDeskModel } from '@/lib/fixtures-fdr'
import { normalizePosition } from '@/lib/utils'

export type MarketCompareCandidate = {
	playerId: number
	webName: string
	teamShortName: string
	positionCode: string
	bucket: 'popular-favourable' | 'differential-favourable'
	avgFdr: number | null
	selectedByPercent: number
	price: number
	nextOpponent: string | null
}

function positionCodeFromMarket(position: string): string {
	const code = normalizePosition(position)
	return code === 'UNK' ? 'MID' : code
}

export function buildMarketCompareCandidates(
	model: FdrDeskModel,
): MarketCompareCandidate[] {
	const popularFavourable = model.candidates.popularFavourable.map(p => ({
		playerId: p.playerId,
		webName: p.webName,
		teamShortName: p.teamShortNameResolved,
		positionCode: positionCodeFromMarket(p.position),
		bucket: 'popular-favourable' as const,
		avgFdr: p.avgFdr,
		selectedByPercent: p.selectedByPercent,
		price: p.price,
		nextOpponent: p.nextOpponent,
	}))
	const differentialFavourable = model.candidates.differentialFavourable.map(p => ({
		playerId: p.playerId,
		webName: p.webName,
		teamShortName: p.teamShortNameResolved,
		positionCode: positionCodeFromMarket(p.position),
		bucket: 'differential-favourable' as const,
		avgFdr: p.avgFdr,
		selectedByPercent: p.selectedByPercent,
		price: p.price,
		nextOpponent: p.nextOpponent,
	}))
	return [...popularFavourable, ...differentialFavourable]
}

export function filterMarketCompareCandidates(
	candidates: MarketCompareCandidate[],
	positionCode: string,
): MarketCompareCandidate[] {
	const code = positionCode.toUpperCase()
	return candidates.filter(c => c.positionCode === code)
}
