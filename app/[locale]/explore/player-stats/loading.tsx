import { RouteLoadingSkeleton } from '@/components/feedback/RouteLoadingSkeleton'

export default function Loading() {
	return (
		<>
			<noscript>
				<span id="ps-fixtures" data-player-stats-noscript-anchor="fixtures" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-recent" data-player-stats-noscript-anchor="recent" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-season" data-player-stats-noscript-anchor="season" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-process" data-player-stats-noscript-anchor="process" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-history" data-player-stats-noscript-anchor="history" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-market" data-player-stats-noscript-anchor="market" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
				<span id="ps-coverage" data-player-stats-noscript-anchor="coverage" className="block h-px w-px scroll-mt-36" aria-hidden="true" />
			</noscript>
			<RouteLoadingSkeleton variant="list" />
		</>
	)
}
