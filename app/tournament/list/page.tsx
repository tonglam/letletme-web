import { Suspense } from 'react'
import TournamentListClient from './TournamentListClient'

export default function Page() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentListClient />
		</Suspense>
	)
}
