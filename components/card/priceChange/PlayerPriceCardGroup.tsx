import {
	PlayerPriceCard,
	PlayerPriceCardProps
} from '@/components/card/priceChange/PlayerPriceCard'
import React from 'react'

function PlayerPriceCardGroup({
	children,
	priceChanges
}: {
	children: React.ReactNode
	priceChanges: PlayerPriceCardProps[]
}) {
	return (
		<>
			{priceChanges.map(priceChange => (
				<div
					key={priceChange.element}
					className="flex mt-0.5 items-center px-4 outline outline-gray-200"
				>
					{children}
					<PlayerPriceCard playerPriceProps={priceChange} />
				</div>
			))}
		</>
	)
}

export { PlayerPriceCardGroup }
