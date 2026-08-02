import type { Metadata } from 'next'
import CreateTournamentClient from './CreateTournamentClient'

export const metadata: Metadata = {
	title: 'Create tournament',
	description: 'Create a private FPL tournament and choose its scoring rules.',
}

export default function CreateTournamentPage() {
	return <CreateTournamentClient />
}
