import { PriceChangeColumns } from '@/components/dataTable/PriceChangeColumns'
import { PriceChangeDataTable } from '@/components/dataTable/PriceChangeDataTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { API_STAT } from '@/lib/config'
import { getLogger } from '@/utils/logger'
import { Suspense } from 'react'

const logger = getLogger('app:stat:price')

async function fetchPriceChange(date: string) {
	const res = await fetch(`${API_STAT.QRY_PLAYER_PRICE_CHANGE}?date=${date}`)

	if (!res.ok) {
		logger.error('Failed to fetch data')
		throw new Error('Failed to fetch data')
	}

	return await res.json()
}

export default async function Page() {
	const data = await fetchPriceChange('20240220')

	return (
		<section>
			<div className="container">
				<Tabs defaultValue="price">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="price">Price Change</TabsTrigger>
						<TabsTrigger value="selection">Selection</TabsTrigger>
						<TabsTrigger value="player">Player Stat</TabsTrigger>
					</TabsList>
					<TabsContent value="price">
						<Suspense fallback={<p>Loading...</p>}>
							<PriceChangeDataTable
								columns={PriceChangeColumns}
								data={data}
							/>
						</Suspense>
					</TabsContent>
					<TabsContent value="selection">
						<a>selection</a>
					</TabsContent>
					<TabsContent value="player">
						<a>player</a>
					</TabsContent>
				</Tabs>
			</div>
		</section>
	)
}
