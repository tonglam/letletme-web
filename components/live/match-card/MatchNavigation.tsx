import { Button } from '@/components/ui/button'
import type { Match } from '@/types/match'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface MatchNavigationProps {
	allMatches?: Match[]
	currentIndex?: number
}

export function MatchNavigation({
	allMatches,
	currentIndex,
}: MatchNavigationProps) {
	const t = useTranslations('LiveMatches')
	if (!allMatches || currentIndex === undefined) return null
	const hasPrevious = currentIndex > 0
	const hasNext = currentIndex < allMatches.length - 1
	if (!hasPrevious && !hasNext) return null

	const navigate = (direction: 'previous' | 'next') => {
		const targetIndex =
			direction === 'next' ? currentIndex + 1 : currentIndex - 1
		const targetMatch = allMatches[targetIndex]
		if (!targetMatch) return
		document
			.querySelector(`[data-match-id="${targetMatch.id}"]`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<>
			{hasPrevious ? (
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-8 rounded-full border-border/70 bg-card/90 shadow-sm backdrop-blur-sm hover:bg-accent"
					data-match-navigation="true"
					onClick={() => navigate('previous')}
					aria-label={t('previousMatch')}
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
				</Button>
			) : null}
			{hasNext ? (
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-8 rounded-full border-border/70 bg-card/90 shadow-sm backdrop-blur-sm hover:bg-accent"
					data-match-navigation="true"
					onClick={() => navigate('next')}
					aria-label={t('nextMatch')}
				>
					<ChevronRight className="size-4" aria-hidden="true" />
				</Button>
			) : null}
		</>
	)
}
