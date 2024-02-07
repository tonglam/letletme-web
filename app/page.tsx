import { CountDown } from '@/components/countDown/CountDown'
import { Separator } from '@/components/ui/separator'
import picture from '@/public/images/donot_trust.png'
import Image from 'next/image'

async function getDDL() {
	const url: string = process.env.CURRENT_EVENT_AND_NEXT_UTC_DEADLINE!
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error('Failed to fetch data')
	}

	return res.json()
}

export default async function Home() {
	const ddl = await getDDL()

	return (
		<main>
			<div className="container mx-auto px-28 flex flex-col w-full items-center justify-between space-y-12 mt-16">
				<Image
					className="border-2 border-black dark:border-slate-500 drop-shadow-xl shadow-black rounded-lg"
					src={picture}
					alt="Welcome"
					sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
					priority={true}
				/>
				<p>aaaaaaaaaa</p>
				<CountDown utcTime="2024-02-10T11:00:00Z" />
				<div>
					<ul>
						<li className="flex h-5 items-center space-x-4 text-base">
							<div className="font-medium">Arsenal vs Manchester City</div>
							<Separator orientation="vertical" />
							<div>2023-12-06 03:30:00</div>
						</li>
						<Separator className="my-2" />
						<li className="flex h-5 items-center space-x-4 text-base">
							<div className="font-medium">Arsenal vs Manchester City</div>
							<Separator orientation="vertical" />
							<div>2023-12-06 03:30:00</div>
						</li>
					</ul>
				</div>
			</div>
		</main>
	)
}
