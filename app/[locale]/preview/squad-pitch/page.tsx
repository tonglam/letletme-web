import PageShell from '@/components/layout/PageShell'
import {
	SquadPitch,
	type SquadPitchPlayer,
} from '@/components/squad-pitch/SquadPitch'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Squad Pitch Preview',
	description: 'Reusable LetLetMe squad pitch component preview.',
	robots: {
		index: false,
		follow: false,
	},
}

const mockPlayers: readonly SquadPitchPlayer[] = [
	{
		id: 'raya',
		webName: 'Raya',
		score: 6,
		teamCode: 'ARS',
		position: 'GKP',
		isViceCaptain: true,
	},
	{
		id: 'gabriel',
		webName: 'Gabriel',
		score: 6,
		teamCode: 'ARS',
		position: 'DEF',
	},
	{
		id: 'gvardiol',
		webName: 'Gvardiol',
		score: 11,
		teamCode: 'MCI',
		position: 'DEF',
	},
	{
		id: 'senesi',
		webName: 'Senesi',
		score: 14,
		teamCode: 'BOU',
		position: 'DEF',
	},
	{
		id: 'szoboszlai',
		webName: 'Szoboszlai',
		score: 13,
		teamCode: 'LIV',
		position: 'MID',
	},
	{
		id: 'saka',
		webName: 'Saka',
		score: 9,
		teamCode: 'ARS',
		position: 'MID',
	},
	{
		id: 'palmer',
		webName: 'Palmer',
		score: 7,
		teamCode: 'CHE',
		position: 'MID',
	},
	{
		id: 'bruno',
		webName: 'B.Fernandes',
		score: 5,
		teamCode: 'MUN',
		position: 'MID',
	},
	{
		id: 'joao-pedro',
		webName: 'João Pedro',
		score: 8,
		teamCode: 'CHE',
		position: 'FWD',
	},
	{
		id: 'gyokeres',
		webName: 'Gyökeres',
		score: 32,
		teamCode: 'ARS',
		position: 'FWD',
		isCaptain: true,
	},
	{
		id: 'thiago',
		webName: 'Thiago',
		score: 6,
		teamCode: 'BRE',
		position: 'FWD',
	},
]

export default function SquadPitchPreviewPage() {
	return (
		<PageShell className="bg-[radial-gradient(circle_at_50%_0%,hsl(var(--electric)/0.09),transparent_36%),hsl(var(--background))]">
			<div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8">
				<header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-2xl">
						<p className="chyron">Component preview</p>
						<h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
							Squad pitch
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
							A reusable 3–4–3 mock lineup. Player name, score, club shirt,
							captain and vice-captain are all supplied as component props.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2 font-mono text-caption uppercase tracking-caps text-muted-foreground">
						<span className="rounded-full border bg-card px-3 py-1.5">Mock data</span>
						<span className="rounded-full border bg-card px-3 py-1.5">3–4–3</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1.5">
							<span className="grid size-5 place-items-center rounded-full border border-electric bg-[#111315] font-display text-[10px] font-bold text-[#f5f1e8]">
								C
							</span>
							Captain
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1.5">
							<span className="grid size-5 place-items-center rounded-full border border-[#f5f1e8] bg-[#111315] font-display text-[10px] font-bold text-[#f5f1e8]">
								V
							</span>
							Vice
						</span>
					</div>
				</header>

				<SquadPitch
					players={mockPlayers}
					title="Wildcard Atelier"
					eyebrow="Gameweek 01 · Mock lineup"
				/>
			</div>
		</PageShell>
	)
}
