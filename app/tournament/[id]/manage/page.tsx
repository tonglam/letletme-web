import { generateStaticParams } from '../staticParams'
export { generateStaticParams }

import { ManageTournamentClient } from './client'

export default function Page({ params }: { params: { id: string } }) {
	return <ManageTournamentClient params={params} />
}
