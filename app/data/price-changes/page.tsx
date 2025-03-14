'use client'

import { DateSelector } from '@/components/data/DateSelector'
import { PlayerSelector } from '@/components/data/PlayerSelector'
import { PriceChangeList } from '@/components/data/PriceChangeList'
import { StatsTable } from '@/components/data/StatsTable'
import RootLayout from '@/components/layout/RootLayout'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayerOption } from '@/types/common'
import { format, parseISO, subDays } from 'date-fns'
import { useEffect, useState } from 'react'

const formatCompactNumber = (num: number): string => {
	return num >= 1000000
		? `${(num / 1000000).toFixed(1)}M`
		: num >= 1000
		? `${(num / 1000).toFixed(1)}K`
		: num.toString()
}

interface PriceChange {
	player: PlayerOption
	oldPrice: number
	newPrice: number
	date: string
	transfersIn?: number
	transfersOut?: number
}

// Mock data for price changes
const generateMockPriceChanges = (
	date: string
): { rises: PriceChange[]; falls: PriceChange[] } => {
	// Get players from the PlayerSelector mock data
	const mockPlayers = [
		{ id: '13', name: 'M.Salah', position: 'MID', team: 'LIV', price: 13.2 },
		{ id: '23', name: 'Haaland', position: 'FWD', team: 'MCI', price: 14.5 },
		{ id: '15', name: 'Saka', position: 'MID', team: 'ARS', price: 9.8 },
		{ id: '22', name: 'Foden', position: 'MID', team: 'MCI', price: 8.8 },
		{ id: '8', name: 'Trippier', position: 'DEF', team: 'NEW', price: 6.5 },
		{ id: '18', name: 'Ødegaard', position: 'MID', team: 'ARS', price: 8.4 },
		{ id: '17', name: 'Son', position: 'MID', team: 'TOT', price: 10.0 },
		{ id: '26', name: 'Watkins', position: 'FWD', team: 'AVL', price: 8.7 },
		{ id: '9', name: 'Van Dijk', position: 'DEF', team: 'LIV', price: 6.3 },
		{ id: '16', name: 'Fernandes', position: 'MID', team: 'MUN', price: 8.4 },
		{ id: '24', name: 'N.Jackson', position: 'FWD', team: 'CHE', price: 7.1 },
		{ id: '12', name: 'Muñoz', position: 'DEF', team: 'CRY', price: 4.5 }
	] as PlayerOption[]

	// Calculate a seed based on the date to ensure consistent but different results for different days
	const dateSeed = Date.parse(date) % 10000

	// Generate price rises
	const rises = mockPlayers.slice(0, 5).map((player, index) => {
		const priceRise = (0.1 + index * 0.05 + (dateSeed % 100) / 1000) % 0.3
		return {
			player,
			oldPrice: player.price - priceRise,
			newPrice: player.price,
			date,
			transfersIn: 150000 + index * 50000 + (dateSeed % 1000) * 100
		}
	})

	// Generate price falls
	const falls = mockPlayers.slice(6, 11).map((player, index) => {
		const priceFall =
			(0.1 + index * 0.05 + ((dateSeed + 500) % 100) / 1000) % 0.3
		return {
			player,
			oldPrice: player.price + priceFall,
			newPrice: player.price,
			date,
			transfersOut: 100000 + index * 40000 + ((dateSeed + 500) % 1000) * 80
		}
	})

	return { rises, falls }
}

// Generate player price history for a specific player
const generatePlayerPriceHistory = (
	player: PlayerOption | null
): PriceChange[] => {
	if (!player) return []

	const history: PriceChange[] = []
	const today = new Date()
	let currentPrice = player.price

	// Generate 10 price changes historically
	for (let i = 0; i < 10; i++) {
		const dateOffset = i * 3 + (player.id.charCodeAt(0) % 3) // Use player ID to vary the pattern
		const changeDate = subDays(today, dateOffset)
		const isRise = (i + parseInt(player.id)) % 3 !== 0 // Mix of rises and falls
		const priceChange = ((i % 3) + 1) * 0.1 // 0.1, 0.2, or 0.3 price changes

		const previousPrice = isRise
			? currentPrice - priceChange
			: currentPrice + priceChange

		history.push({
			player,
			oldPrice: previousPrice,
			newPrice: currentPrice,
			date: format(changeDate, 'yyyy-MM-dd'),
			transfersIn: isRise ? 100000 + i * 20000 : undefined,
			transfersOut: !isRise ? 80000 + i * 15000 : undefined
		})

		currentPrice = previousPrice // For the next historical data point
	}

	return history
}

export default function PriceChangesPage() {
	const [selectedDate, setSelectedDate] = useState<string>(
		format(new Date(), 'yyyy-MM-dd')
	)
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(
		null
	)
	const [priceChanges, setPriceChanges] = useState<{
		rises: PriceChange[]
		falls: PriceChange[]
	}>({ rises: [], falls: [] })
	const [playerPriceHistory, setPlayerPriceHistory] = useState<PriceChange[]>(
		[]
	)
	const [activeTab, setActiveTab] = useState<string>('daily')

	// Initial data load
	useEffect(() => {
		// Update price changes when date changes (for daily view)
		setPriceChanges(generateMockPriceChanges(selectedDate))
	}, [selectedDate])

	// Handle player change
	useEffect(() => {
		// Update player price history when player selection changes
		if (selectedPlayer) {
			setPlayerPriceHistory(generatePlayerPriceHistory(selectedPlayer))
			setActiveTab('player')
		}
	}, [selectedPlayer])

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-6">Price Changes</h1>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<DateSelector
						onDateChange={date => {
							setSelectedDate(date)
							setActiveTab('daily')
						}}
					/>

					<PlayerSelector
						onPlayerChange={player => setSelectedPlayer(player)}
					/>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="mb-8"
				>
					<TabsList className="grid grid-cols-2 mb-4">
						<TabsTrigger value="daily">Daily Price Changes</TabsTrigger>
						<TabsTrigger
							value="player"
							disabled={!selectedPlayer}
						>
							Player Price History
						</TabsTrigger>
					</TabsList>

					<TabsContent value="daily">
						<Card className="p-6">
							<h2 className="text-2xl font-bold mb-2">
								Price Changes for{' '}
								{format(parseISO(selectedDate), 'd MMMM yyyy')}
							</h2>
							<p className="text-muted-foreground mb-6">
								The latest price movements in the Fantasy Premier League market
							</p>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								<PriceChangeList
									title="Price Rises"
									changes={priceChanges.rises}
									type="rise"
								/>
								<PriceChangeList
									title="Price Falls"
									changes={priceChanges.falls}
									type="fall"
								/>
							</div>
						</Card>
					</TabsContent>

					<TabsContent value="player">
						{selectedPlayer && (
							<Card className="p-6">
								<h2 className="text-2xl font-bold mb-2">
									Price History for {selectedPlayer.name}
								</h2>
								<p className="text-muted-foreground mb-6">
									{selectedPlayer.position} | {selectedPlayer.team} | Current
									Price: £{selectedPlayer.price.toFixed(1)}m
								</p>

								<StatsTable
									title="Historical Price Changes"
									data={playerPriceHistory}
									columns={[
										{
											key: 'date',
											label: 'Date',
											format: value => format(parseISO(value), 'dd MMM yyyy')
										},
										{
											key: 'oldPrice',
											label: 'Old Price',
											format: value => `£${value.toFixed(1)}m`
										},
										{
											key: 'newPrice',
											label: 'New Price',
											format: value => `£${value.toFixed(1)}m`
										},
										{
											key: 'change',
											label: 'Change',
											format: (_, row) => {
												const change = row.newPrice - row.oldPrice
												const className =
													change > 0 ? 'text-emerald-600' : 'text-rose-600'
												return (
													<span className={className}>
														{change > 0 ? '+' : ''}£{change.toFixed(1)}m
													</span>
												)
											}
										},
										{
											key: 'transfers',
											label: 'Transfers',
											format: (_, row) => {
												if (row.transfersIn) {
													return (
														<span className="text-emerald-600">
															{formatCompactNumber(row.transfersIn)} in
														</span>
													)
												} else if (row.transfersOut) {
													return (
														<span className="text-rose-600">
															{formatCompactNumber(row.transfersOut)} out
														</span>
													)
												}
												return ''
											}
										}
									]}
								/>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				<div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground">
					<p>
						Price changes typically occur at approximately 2:30 AM (UK time)
						each day during the FPL season. The exact algorithm used by FPL is
						not public, but price changes are driven by transfer activity.
					</p>
				</div>
			</div>
		</RootLayout>
	)
}
