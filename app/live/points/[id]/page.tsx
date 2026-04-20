import { Metadata } from 'next'
import { Suspense } from 'react'
import TeamPointsClient from './TeamPointsClient'

export const dynamicParams = false

export async function generateMetadata({
	params
}: {
	params: Promise<{ id: string }>
}): Promise<Metadata> {
	const { id } = await params
	return {
		title: `Points - ${id}`
	}
}

export function generateStaticParams() {
	// Pre-generate routes for known team IDs (required for static export)
	return [
		{ id: '1' },
		{ id: '2' },
		{ id: '3' },
		{ id: '4' },
		{ id: '5' },
		{ id: '6' },
		{ id: '7' },
		{ id: '8' }
	]
}

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id } = await params
	return (
		<Suspense
			fallback={
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="bg-card rounded-lg shadow-sm p-6 text-sm text-muted-foreground">
						Loading team points...
					</div>
				</div>
			}
		>
			<TeamPointsClient params={{ id }} />
		</Suspense>
	)
}
