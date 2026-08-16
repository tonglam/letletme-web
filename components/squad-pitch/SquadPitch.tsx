import Image from 'next/image'
import { forwardRef, type CSSProperties } from 'react'

export type SquadPosition = 'GKP' | 'DEF' | 'MID' | 'FWD'

export type SquadTeamCode =
	| 'ARS'
	| 'AVL'
	| 'BOU'
	| 'BRE'
	| 'BHA'
	| 'CHE'
	| 'COV'
	| 'CRY'
	| 'EVE'
	| 'FUL'
	| 'HUL'
	| 'IPS'
	| 'LEE'
	| 'LIV'
	| 'MCI'
	| 'MUN'
	| 'NEW'
	| 'NFO'
	| 'SUN'
	| 'TOT'

export interface SquadPitchPlayer {
	id: string
	webName: string
	score: number
	teamCode: SquadTeamCode
	position: SquadPosition
	isCaptain?: boolean
	isViceCaptain?: boolean
}

interface SquadPitchProps {
	players: readonly SquadPitchPlayer[]
	title?: string
	managerName?: string
	eyebrow?: string
	headerStats?: SquadPitchHeaderStats
	className?: string
}

export interface SquadPitchHeaderStats {
	eyebrow: string
	details: readonly SquadPitchHeaderDetail[]
}

export interface SquadPitchHeaderDetail {
	label: string
	value: string
	accent?: boolean
}

const POSITION_ORDER: readonly SquadPosition[] = ['GKP', 'DEF', 'MID', 'FWD']

const POSITION_LABELS: Record<SquadPosition, string> = {
	GKP: 'Goalkeeper',
	DEF: 'Defenders',
	MID: 'Midfielders',
	FWD: 'Forwards',
}

const POSITION_ROW_CLASS: Record<SquadPosition, string> = {
	GKP: 'top-[13.1%]',
	DEF: 'top-[32.5%]',
	MID: 'top-[52.2%]',
	FWD: 'top-[72.8%]',
}

function PlayerMarker({ player }: { player: SquadPitchPlayer }) {
	const marker = player.isCaptain ? 'C' : player.isViceCaptain ? 'V' : null
	if (!marker) return null

	const label = marker === 'C' ? 'Captain' : 'Vice-captain'
	const borderClass = marker === 'C' ? 'border-electric' : 'border-[#f5f1e8]'

	return (
		<span
			aria-label={label}
			className={`absolute left-[3%] top-[7%] z-20 grid size-[clamp(1.1rem,3.6cqi,1.8rem)] place-items-center rounded-full border-2 bg-[#111315] font-display text-[clamp(0.62rem,1.9cqi,0.95rem)] font-bold leading-none text-[#f5f1e8] shadow-[0_4px_10px_rgba(0,0,0,0.38)] ${borderClass}`}
		>
			{marker}
		</span>
	)
}

function PlayerCard({ player }: { player: SquadPitchPlayer }) {
	return (
		<li
			aria-label={`${player.webName}, ${player.score} points`}
			className="relative flex w-[clamp(3.25rem,14cqi,7.2rem)] list-none flex-col items-center transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none"
		>
			<div className="relative z-10 -mb-[clamp(0.25rem,0.8cqi,0.45rem)] w-[90%] drop-shadow-[0_9px_8px_rgba(0,24,16,0.28)]">
				<Image
					src={`/images/squad-pitch/kits/${player.teamCode}.svg`}
					alt=""
					aria-hidden="true"
					width={240}
					height={220}
					sizes="(max-width: 480px) 48px, (max-width: 900px) 10vw, 104px"
					loading={player.position === 'GKP' ? 'eager' : 'lazy'}
					className="h-auto w-full select-none"
					unoptimized
				/>
				<PlayerMarker player={player} />
			</div>

			<div className="relative z-20 w-full overflow-hidden rounded-[clamp(0.2rem,0.8cqi,0.45rem)] border border-white/45 shadow-[0_7px_14px_rgba(0,37,23,0.3)]">
				<div className="flex h-[clamp(0.95rem,3.25cqi,1.65rem)] items-center justify-center bg-[#f8f6ef] px-[clamp(0.16rem,0.7cqi,0.4rem)] text-[#38003c]">
					<span className="max-w-full truncate font-display text-[clamp(0.48rem,1.6cqi,0.84rem)] font-bold leading-none tracking-[-0.01em]">
						{player.webName}
					</span>
				</div>
				<div className="flex h-[clamp(0.9rem,3cqi,1.5rem)] items-center justify-center bg-[#38003c] px-1 text-[#f8f6ef]">
					<span className="font-display text-[clamp(0.5rem,1.75cqi,0.9rem)] font-bold leading-none tabular-nums">
						{player.score}
					</span>
				</div>
			</div>
		</li>
	)
}

function PositionRow({
	position,
	players,
}: {
	position: SquadPosition
	players: readonly SquadPitchPlayer[]
}) {
	if (players.length === 0) return null

	return (
		<ol
			aria-label={POSITION_LABELS[position]}
			className={`absolute inset-x-[4.2%] z-10 grid items-start justify-items-center ${POSITION_ROW_CLASS[position]}`}
			style={
				{
					gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`,
				} satisfies CSSProperties
			}
		>
			{players.map(player => (
				<PlayerCard key={player.id} player={player} />
			))}
		</ol>
	)
}

export const SquadPitch = forwardRef<HTMLElement, SquadPitchProps>(function SquadPitch(
	{
		players,
		title = 'LetLetMe XI',
		managerName,
		eyebrow = 'Gameweek squad',
		headerStats,
		className = '',
	},
	ref
) {
	const totalScore = players.reduce((total, player) => total + player.score, 0)

	return (
		<section
			ref={ref}
			aria-label={`${title} formation`}
			className={`relative isolate aspect-[1304/1244] w-full overflow-hidden rounded-xl border border-[#00ff85]/35 bg-[#210025] shadow-[0_30px_80px_-34px_rgba(21,0,25,0.78)] [container-type:inline-size] sm:rounded-2xl ${className}`}
		>
			<Image
				src="/images/squad-pitch/pitch-background.svg"
				alt=""
				aria-hidden="true"
				fill
				priority
				sizes="(max-width: 900px) 100vw, 860px"
				className="pointer-events-none select-none object-cover"
				unoptimized
			/>

			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_30%,rgba(0,31,20,0.13)_100%)]" />

			<header className="absolute inset-x-[5.2%] top-[1.93%] z-20 flex h-[10.13%] items-center justify-between gap-[clamp(0.75rem,3cqi,2rem)] text-[#f8f6ef]">
				<div className="flex min-w-0 flex-col justify-center">
					<p className="truncate font-mono text-[clamp(0.42rem,1.15cqi,0.66rem)] font-medium uppercase leading-none tracking-[0.18em] text-[#00ff85]">
						{headerStats?.eyebrow ?? eyebrow}
					</p>
					<h2 className="truncate font-display text-[clamp(0.78rem,2.55cqi,1.55rem)] font-bold uppercase leading-none tracking-[0.04em]">
						{title}
					</h2>
					{managerName ? (
						<p className="mt-[clamp(0.08rem,0.35cqi,0.2rem)] truncate font-mono text-[clamp(0.68rem,1.55cqi,0.95rem)] leading-none text-white/70">
							{managerName}
						</p>
					) : null}
				</div>
				{headerStats ? (
					<div className="flex min-w-[clamp(6.5rem,18cqi,9.25rem)] self-stretch shrink-0 flex-col justify-center border-l border-white/25 pl-[clamp(0.5rem,1.9cqi,1.1rem)] font-mono tabular-nums">
						{headerStats.details.map(detail => (
							<p
								key={detail.label}
								className="flex min-h-[clamp(0.95rem,2.65cqi,1.3rem)] items-center justify-end gap-[clamp(0.3rem,0.85cqi,0.6rem)] whitespace-nowrap leading-none"
							>
								<span className="text-[clamp(0.58rem,1.35cqi,0.78rem)] uppercase tracking-[0.08em] text-white/55">
									{detail.label}
								</span>
								<span
									className={
										detail.accent
											? 'font-display text-[clamp(0.82rem,2cqi,1.15rem)] font-bold leading-none text-[#00ff85]'
											: 'font-mono text-[clamp(0.68rem,1.6cqi,0.92rem)] font-semibold leading-none text-white/85'
									}
								>
									{detail.value}
								</span>
							</p>
						))}
					</div>
				) : (
					<div className="shrink-0 border-l border-white/20 pl-[clamp(0.5rem,1.7cqi,1rem)] text-right">
						<p className="font-mono text-[clamp(0.4rem,1cqi,0.6rem)] uppercase tracking-[0.16em] text-white/60">
							Total
						</p>
						<p className="font-display text-[clamp(0.8rem,2.4cqi,1.45rem)] font-bold leading-none tabular-nums text-[#00ff85]">
							{totalScore}
						</p>
					</div>
				)}
			</header>

			<div
				aria-hidden="true"
				data-watermark="letletme"
				className="pointer-events-none absolute inset-x-0 bottom-[2.2%] z-20 flex items-center justify-center gap-[clamp(0.35rem,1.5cqi,0.9rem)] select-none text-[#f8f6ef]/35"
			>
				<span className="h-px w-[clamp(1.1rem,7cqi,3.5rem)] bg-gradient-to-r from-transparent via-[#00ff85]/35 to-transparent" />
				<span className="font-mono text-[clamp(0.42rem,1.05cqi,0.68rem)] font-semibold uppercase tracking-[0.28em] [text-shadow:0_1px_4px_rgba(0,0,0,0.35)]">
					LETLETME
				</span>
				<span className="h-px w-[clamp(1.1rem,7cqi,3.5rem)] bg-gradient-to-r from-[#00ff85]/35 via-[#f8f6ef]/20 to-transparent" />
			</div>

			{POSITION_ORDER.map(position => (
				<PositionRow
					key={position}
					position={position}
					players={players.filter(player => player.position === position)}
				/>
			))}
		</section>
	)
})
