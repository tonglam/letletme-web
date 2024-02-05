import { Separator } from '@/components/ui/separator';

export default function Home() {
	return (
		<main className="flex min-h-full flex-col items-center justify-between p-5">
			{/* <section className="w-full mx-auto">
				<Image
					className="border-4 border-black dark:border-slate-500 drop-shadow-xl shadow-black rounded-full mx-auto mt-8"
					src={picture}
					alt="Welcome Picture"
					priority={true}
				/>
			</section>
			<br /> */}
			<div className="text-2xl items-center">
				<p>GW15</p>
				<p>2021-12-06 03:30:00</p>
				<p>这破游戏</p>
			</div>
			<br />
			<div>
				<div className="space-y-1">
					<h4 className="text-xl font-bold text-slate-500 leading-none">
						GW15 赛程
					</h4>
				</div>
				<Separator className="my-4" />
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
						<Separator className="my-2" />
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
						<Separator className="my-2" />
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
						<Separator className="my-2" />
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
						<Separator className="my-2" />
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
						<Separator className="my-2" />
					</ul>
				</div>
			</div>
		</main>
	);
}
