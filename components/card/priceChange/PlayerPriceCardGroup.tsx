import {
	PlayerPriceCard,
	PlayerPriceCardProps
} from '@/components/card/priceChange/PlayerPriceCard'
import React from 'react'

export const PlayerPriceCardGroup = ({
	children,
	priceChanges
}: {
	children: React.ReactNode
	priceChanges: PlayerPriceCardProps[]
}) => {
	return (
		<div>
			{priceChanges.map(priceChange => (
				<div
					key={priceChange.element}
					className="flex mt-0.5 items-center px-4 outline outline-gray-200"
				>
					{children}
					<PlayerPriceCard playerPriceProps={priceChange} />
				</div>
			))}
		</div>
	)
}
