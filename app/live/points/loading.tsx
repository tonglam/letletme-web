import RootLayout from '@/components/layout/RootLayout'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="mb-6 space-y-2">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-10 w-full rounded-lg" />
				</div>

				<div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8 p-6">
					<Skeleton className="h-8 w-56 mb-2" />
					<Skeleton className="h-5 w-32 mb-8" />
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
						{[1, 2, 3, 4].map(i => (
							<div
								key={i}
								className="bg-primary/5 rounded-lg p-4"
							>
								<Skeleton className="h-5 w-20 mb-3" />
								<Skeleton className="h-8 w-16" />
							</div>
						))}
					</div>
				</div>

				<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
					<div className="grid grid-cols-2 gap-2 sm:gap-4">
						<Skeleton className="h-10 w-full rounded-md" />
						<Skeleton className="h-10 w-full rounded-md" />
					</div>
				</div>

				<div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
					{[1, 2, 3, 4, 5, 6].map(i => (
						<div
							key={i}
							className="p-4 border-b last:border-b-0"
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4 flex-1">
									<Skeleton className="h-4 w-12" />
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-4 w-32" />
								</div>
								<div className="flex items-center gap-4">
									<Skeleton className="h-10 w-10" />
									<Skeleton className="h-10 w-14" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</RootLayout>
	)
}
