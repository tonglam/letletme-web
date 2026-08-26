'use client'

import {
	HomeAutoCarousel,
	type HomeAutoCarouselLabels,
	type HomeAutoCarouselSlide
} from '@/components/home/HomeAutoCarousel'
import { ShareActions } from '@/components/share/ShareActions'
import { useRef } from 'react'

export type PersonalLeagueCarouselSlide = HomeAutoCarouselSlide
export type PersonalLeagueCarouselLabels = HomeAutoCarouselLabels

export function PersonalLeagueCarousel({
	slides,
	labels,
	title
}: {
	slides: PersonalLeagueCarouselSlide[]
	labels: PersonalLeagueCarouselLabels
	title: string
}) {
	const shareRef = useRef<HTMLDivElement | null>(null)

	return (
		<div data-home-league-group>
			<div
				ref={shareRef}
				data-share-preserve-width="true"
				data-share-fit-content="true"
				className="rounded-lg bg-card"
			>
				<div className="mb-2 flex items-center justify-between gap-3">
					<p className="eyebrow">{title}</p>
					<ShareActions
						actions={['image']}
						text={title}
						imageRef={shareRef}
						title={title}
						compact
					/>
				</div>
				<HomeAutoCarousel
					slides={slides}
					labels={labels}
					dataAttribute="personal-league"
				/>
			</div>
		</div>
	)
}
