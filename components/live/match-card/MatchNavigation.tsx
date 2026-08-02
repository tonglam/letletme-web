import { Button } from '@/components/ui/button'
import type { Match } from '@/types/match'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MatchNavigationProps {
	allMatches?: Match[]
	currentIndex?: number
}

export function MatchNavigation({ allMatches, currentIndex }: MatchNavigationProps) {
	if (!allMatches || currentIndex === undefined) return null
	const hasPrevious = currentIndex > 0
	const hasNext = currentIndex < allMatches.length - 1
	if (!hasPrevious && !hasNext) return null

	const navigate = (direction: 'previous' | 'next') => {
		const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
		const targetMatch = allMatches[targetIndex]
		if (!targetMatch) return
		document.querySelector(`[data-match-id="${targetMatch.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<nav aria-label="Match navigation" className="absolute right-4 top-4 z-10 flex items-center gap-2">
			{hasPrevious ? (
				<Button type="button" variant="outline" size="icon" className="rounded-full bg-background/80 backdrop-blur-sm" onClick={() => navigate('previous')} aria-label="Previous match">
					<ChevronLeft aria-hidden="true" />
				</Button>
			) : null}
			{hasNext ? (
				<Button type="button" variant="outline" size="icon" className="rounded-full bg-background/80 backdrop-blur-sm" onClick={() => navigate('next')} aria-label="Next match">
					<ChevronRight aria-hidden="true" />
				</Button>
			) : null}
		</nav>
	)
}
