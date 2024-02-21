'use client'

import Link from 'next/link'

export type PlayerPriceCardProps = {
	element: number
	webName: string
	elementTypeName: string
	teamName: string
	teamShortName: string
	value: number
	lastValue: number
}

export const PlayerPriceCard = ({
	playerPriceProps
}: {
	playerPriceProps: PlayerPriceCardProps
}) => {
	return (
		<div
			className="flex h-full w-full p-3 items-center justify-items-center gap-1"
			onClick={() => console.log('todo: handle click event')}
		>
			<Link
				href="/player/[id]"
				as={`/player/${playerPriceProps.webName}`}
			>
				<div className="flex space-x-10">
					<span>{playerPriceProps.webName}</span>
					<span>{playerPriceProps.elementTypeName}</span>
					<span>{playerPriceProps.teamName}</span>
					<span>£{playerPriceProps.value}m</span>
					<span>£{playerPriceProps.lastValue}m</span>
				</div>
			</Link>
		</div>
	)
}
