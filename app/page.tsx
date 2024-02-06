// import { CountDown } from '@/components/countDown/CountDown'
import NexFixture from '@/components/table/FixtureTable'
// import picture from '@/public/images/donot_trust.png'
// import Image from 'next/image'

export default function Home() {
	return (
		<main className="flex flex-col w-full items-center justify-between">
			<div className="flex flex-col w-full items-center justify-between">
				<div className="flex flex-col space-y-12 mt-8">
					{/* <div className="flex mx-auto">
					<Image
						className="border-2 border-black dark:border-slate-500 drop-shadow-xl shadow-black rounded-lg mx-auto"
						src={picture}
						alt="Welcome"
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						priority={true}
					/>
				</div>
				<div className="mx-auto">
					<CountDown utcTime="2024-02-10T11:00:00Z" />
				</div> */}
					{/* next fixtures */}
					<NexFixture />
					{/* <div>
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
					</div> */}
				</div>
			</div>
		</main>
	)
}
