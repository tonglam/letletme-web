import Link from 'next/link'
import { HiHome } from 'react-icons/hi'
import { HiMiniPresentationChartLine, HiNewspaper } from 'react-icons/hi2'
import { IoStatsChart } from 'react-icons/io5'

function BottomNavBar() {
	return (
		<>
			<div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-gray-200 dark:bg-gray-700 dark:border-gray-600">
				<div className="grid h-full max-w-lg grid-cols-4 mx-auto">
					<button
						type="button"
						className="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group"
					>
						<HiHome className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
						<Link
							className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500"
							href="/"
						>
							Home
						</Link>
					</button>
					<button
						type="button"
						className="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group"
					>
						<HiMiniPresentationChartLine className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
						<Link
							className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500"
							href="/live/entry/1"
						>
							Live
						</Link>
					</button>
					<button
						type="button"
						className="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group"
					>
						<HiNewspaper className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
						<Link
							className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500"
							href="/summary/overall/25"
						>
							Summary
						</Link>
					</button>
					<button
						type="button"
						className="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group"
					>
						<IoStatsChart className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
						<Link
							className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500"
							href="/stat/price/20240101"
						>
							Stat
						</Link>
					</button>
				</div>
			</div>
		</>
	)
}

export { BottomNavBar }
