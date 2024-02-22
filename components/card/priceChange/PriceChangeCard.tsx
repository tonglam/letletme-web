import { PlayerPriceCardProps } from '@/components/card/priceChange/PlayerPriceCard'
// import { PlayerPriceCardGroup } from '@/components/card/priceChange/PlayerPriceCardGroup'
import { API_STAT } from '@/lib/config'
import { getLogger } from '@/utils/logger'
import { format } from 'date-fns'
// import {
// 	IoIosAddCircle,
// 	IoMdArrowDropdownCircle,
// 	IoMdArrowDropupCircle
// } from 'react-icons/io'

const logger = getLogger('app:stat:price')

async function PriceChangeCard() {
	const date = format(new Date(), 'yyyyMMdd')

	const { Rise, Faller, Start } = (await fetchPriceChange(date)) as {
		Rise: PlayerPriceCardProps[]
		Faller: PlayerPriceCardProps[]
		Start: PlayerPriceCardProps[]
	}

	const riseChanges: PlayerPriceCardProps[] = Rise.map(data => {
		return {
			element: data.element,
			webName: data.webName,
			elementTypeName: data.elementTypeName,
			teamName: data.teamName,
			teamShortName: data.teamShortName,
			value: data.value,
			lastValue: data.lastValue
		}
	})

	const fallChanges: PlayerPriceCardProps[] = Faller.map(data => {
		return {
			element: data.element,
			webName: data.webName,
			elementTypeName: data.elementTypeName,
			teamName: data.teamName,
			teamShortName: data.teamShortName,
			value: data.value,
			lastValue: data.lastValue
		}
	})

	const startChanges: PlayerPriceCardProps[] = Start.map(data => {
		return {
			element: data.element,
			webName: data.webName,
			elementTypeName: data.elementTypeName,
			teamName: data.teamName,
			teamShortName: data.teamShortName,
			value: data.value,
			lastValue: data.lastValue
		}
	})

	return (
		<></>

		// <div className="items-center space-y-4">
		// 	{riseChanges && (
		// 		<PlayerPriceCardGroup priceChanges={riseChanges}>
		// 			<IoMdArrowDropupCircle
		// 				size={24}
		// 				color="green"
		// 			/>
		// 		</PlayerPriceCardGroup>
		// 	)}
		// 	{fallChanges && (
		// 		<PlayerPriceCardGroup priceChanges={fallChanges}>
		// 			<IoMdArrowDropdownCircle
		// 				size={24}
		// 				color="red"
		// 			/>
		// 		</PlayerPriceCardGroup>
		// 	)}
		// 	{startChanges && (
		// 		<PlayerPriceCardGroup priceChanges={startChanges}>
		// 			<IoIosAddCircle
		// 				size={24}
		// 				color="gray"
		// 			/>
		// 		</PlayerPriceCardGroup>
		// 	)}
		// </div>
	)
}

async function fetchPriceChange(date: string) {
	const res = await fetch(`${API_STAT.QRY_PLAYER_PRICE_CHANGE}?date=20240220`)

	if (!res.ok) {
		logger.error('Failed to fetch data')
		throw new Error('Failed to fetch data')
	}

	return await res.json()
}

export { PriceChangeCard }
