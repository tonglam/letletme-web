import { DDLCard } from '@/components/card/DDLCard'
import { FixtureCard, FixtureCardProps } from '@/components/card/FixtureCard'
import { API_COMMON } from '@/lib/config'
import picture from '@/public/images/donot_trust.png'
import { getLogger } from '@/utils/logger'
import Image from 'next/image'
import { Suspense } from 'react'

const logger = getLogger('app:page')

async function getDDL() {
	const res = await fetch(API_COMMON.CURRENT_EVENT_AND_NEXT_UTC_DEADLINE, {
		next: { tags: ['event'] }
	})

	if (!res.ok) {
		logger.error('Failed to fetch data')
		throw new Error('Failed to fetch data')
	}

	return await res.json()
}

async function getNextFixtures(event: number) {
	const res = await fetch(`${API_COMMON.QRY_NEXT_FIXTURE}?event=${event}`, {
		next: { tags: ['event'] }
	})

	if (!res.ok) {
		logger.error('Failed to fetch data')
		throw new Error('Failed to fetch data')
	}

	return await res.json()
}

export default async function Home() {
	const { event, utcDeadline }: { event: string; utcDeadline: string } =
		await getDDL()
	const gw = parseInt(event)

	const fixtures: FixtureCardProps[] = await getNextFixtures(gw)

	return (
		<main>
			<div className="container flex flex-col w-full min-h-full items-center justify-between space-y-6 mt-16">
				<Image
					className="border-2 border-black dark:border-slate-500 drop-shadow-xl shadow-black rounded-lg"
					src={picture}
					alt="Welcome"
					priority={true}
				/>
				<Suspense fallback={<p>Loading...</p>}>
					<DDLCard
						nextEvent={gw + 1}
						utcDeadline={utcDeadline}
					/>
				</Suspense>
				<Suspense fallback={<p>Loading...</p>}>
					<FixtureCard fixtures={fixtures} />
				</Suspense>
			</div>
		</main>
	)
}
