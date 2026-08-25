'use client'

import {
	HomeAutoCarousel,
	type HomeAutoCarouselLabels,
	type HomeAutoCarouselSlide
} from '@/components/home/HomeAutoCarousel'

export type PersonalLeagueCarouselSlide = HomeAutoCarouselSlide
export type PersonalLeagueCarouselLabels = HomeAutoCarouselLabels

export function PersonalLeagueCarousel({
	slides,
	labels
}: {
	slides: PersonalLeagueCarouselSlide[]
	labels: PersonalLeagueCarouselLabels
}) {
	return (
		<div data-home-league-group>
			<HomeAutoCarousel
				slides={slides}
				labels={labels}
				dataAttribute="personal-league"
			/>
		</div>
	)
}
