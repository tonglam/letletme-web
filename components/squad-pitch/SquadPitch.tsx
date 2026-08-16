import Image from 'next/image'
import { LogoMark, LogoWordmark } from '@/components/layout/Logo'
import { forwardRef, type CSSProperties, type KeyboardEvent } from 'react'

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
	fixture?: string
	isCaptain?: boolean
	isViceCaptain?: boolean
}

interface SquadPitchProps {
	players: readonly SquadPitchPlayer[]
	benchPlayers?: readonly SquadPitchPlayer[]
	benchTitle?: string
	benchBoost?: boolean
	benchBoostLabel?: string
	benchPointsLabel?: string
	onPlayerClick?: (playerId: string) => void
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
	FWD: 'Forwards'
}

const POSITION_ROW_CLASS: Record<SquadPosition, string> = {
	GKP: 'top-[13.1%]',
	DEF: 'top-[32.5%]',
	MID: 'top-[52.2%]',
	FWD: 'top-[72.8%]'
}

const POSITION_ROW_WITH_BENCH_CLASS: Record<SquadPosition, string> = {
	GKP: 'top-[13.1%]',
	DEF: 'top-[29%] sm:top-[32.5%]',
	MID: 'top-[46%] sm:top-[50%]',
	FWD: 'top-[63%] sm:top-[68%]'
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

function PlayerCard({
	player,
	compact = false,
	onPlayerClick
}: {
	player: SquadPitchPlayer
	compact?: boolean
	onPlayerClick?: (playerId: string) => void
}) {
	const isInteractive = Boolean(onPlayerClick)
	const openPlayerDetail = () => onPlayerClick?.(player.id)
	const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
		if (!isInteractive || (event.key !== 'Enter' && event.key !== ' ')) return
		event.preventDefault()
		openPlayerDetail()
	}

	return (
		<li
			aria-label={
				isInteractive ? `${player.webName}, ${player.score} points` : undefined
			}
			className={`relative flex ${compact ? 'w-[clamp(2.8rem,11.5cqi,6rem)]' : 'w-[clamp(3.25rem,14cqi,7.2rem)]'} list-none flex-col items-center transition-transform duration-200 motion-reduce:transition-none ${isInteractive ? 'cursor-pointer hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff85] focus-visible:ring-offset-2 focus-visible:ring-offset-[#210025]' : ''}`}
			onClick={isInteractive ? openPlayerDetail : undefined}
			onKeyDown={isInteractive ? handleKeyDown : undefined}
			role={isInteractive ? 'button' : undefined}
			tabIndex={isInteractive ? 0 : undefined}
		>
			<div
				className={`relative z-10 ${compact ? '-mb-[clamp(0.2rem,0.65cqi,0.36rem)] w-[86%]' : '-mb-[clamp(0.25rem,0.8cqi,0.45rem)] w-[90%]'} drop-shadow-[0_9px_8px_rgba(0,24,16,0.28)]`}
			>
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
				<div
					className={`flex ${compact ? 'h-[clamp(0.85rem,2.75cqi,1.4rem)]' : 'h-[clamp(0.95rem,3.25cqi,1.65rem)]'} items-center justify-center bg-[#f8f6ef] px-[clamp(0.16rem,0.7cqi,0.4rem)] text-[#38003c]`}
				>
					<span
						className={`max-w-full truncate font-display ${compact ? 'text-[clamp(0.42rem,1.35cqi,0.72rem)]' : 'text-[clamp(0.48rem,1.6cqi,0.84rem)]'} font-bold leading-none tracking-[-0.01em]`}
					>
						{player.webName}
					</span>
				</div>
				<div
					className={`flex ${compact ? 'h-[clamp(0.8rem,2.55cqi,1.3rem)]' : 'h-[clamp(0.9rem,3cqi,1.5rem)]'} items-center justify-center bg-[#38003c] px-1 text-[#f8f6ef]`}
				>
					<span
						className={`font-display ${compact ? 'text-[clamp(0.44rem,1.45cqi,0.76rem)]' : 'text-[clamp(0.5rem,1.75cqi,0.9rem)]'} font-bold leading-none tabular-nums`}
					>
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
	benchVisible,
	onPlayerClick
}: {
	position: SquadPosition
	players: readonly SquadPitchPlayer[]
	benchVisible?: boolean
	onPlayerClick?: (playerId: string) => void
}) {
	if (players.length === 0) return null

	return (
		<ol
			aria-label={POSITION_LABELS[position]}
			className={`absolute inset-x-[4.2%] z-10 grid items-start justify-items-center ${benchVisible ? POSITION_ROW_WITH_BENCH_CLASS[position] : POSITION_ROW_CLASS[position]}`}
			style={
				{
					gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`
				} satisfies CSSProperties
			}
		>
			{players.map(player => (
				<PlayerCard
					key={player.id}
					player={player}
					compact={benchVisible}
					onPlayerClick={onPlayerClick}
				/>
			))}
		</ol>
	)
}

function BenchPlayerCard({
	player,
	label,
	pointsLabel
}: {
	player: SquadPitchPlayer
	label: string
	pointsLabel: string
}) {
	return (
		<li className="min-w-0 list-none">
			<div className="flex min-w-0 items-center gap-[clamp(0.2rem,0.8cqi,0.5rem)] rounded-[clamp(0.2rem,0.7cqi,0.4rem)] border border-white/80 bg-[#f8f6ef]/95 px-[clamp(0.2rem,0.8cqi,0.5rem)] py-[clamp(0.18rem,0.6cqi,0.38rem)] shadow-[0_5px_12px_rgba(0,37,23,0.2)]">
				<Image
					src={`/images/squad-pitch/kits/${player.teamCode}.svg`}
					alt=""
					aria-hidden="true"
					width={100}
					height={80}
					className="h-[clamp(1.55rem,5.8cqi,3.4rem)] w-[clamp(1.8rem,7cqi,4.2rem)] shrink-0 object-contain"
					unoptimized
				/>
				<div className="min-w-0 text-left">
					<p className="truncate font-mono text-[clamp(0.34rem,0.82cqi,0.52rem)] font-bold uppercase leading-tight tracking-[0.08em] text-[#38003c]/55">
						{label}
					</p>
					<p className="truncate font-display text-[clamp(0.42rem,1.2cqi,0.7rem)] font-bold uppercase leading-tight text-[#38003c]">
						{player.webName}
					</p>
					<p className="truncate font-mono text-[clamp(0.36rem,0.9cqi,0.56rem)] tabular-nums leading-tight text-[#38003c]/75">
						{player.fixture ?? player.teamCode}
						<span className="text-[#38003c]/55">
							{' '}
							· {player.score} {pointsLabel}
						</span>
					</p>
				</div>
			</div>
		</li>
	)
}

export const SquadPitch = forwardRef<HTMLElement, SquadPitchProps>(
	function SquadPitch(
		{
			players,
			benchPlayers = [],
			benchTitle = 'Substitutes',
			benchBoost = false,
			benchBoostLabel = 'BB',
			benchPointsLabel = 'pts',
			onPlayerClick,
			title = 'LetLetMe XI',
			managerName,
			eyebrow = 'Gameweek squad',
			headerStats,
			className = ''
		},
		ref
	) {
		const totalScore = players.reduce(
			(total, player) => total + player.score,
			0
		)

		return (
			<section
				ref={ref}
				aria-label={`${title} formation`}
				className={`relative isolate ${benchPlayers.length > 0 ? 'aspect-[4/5] sm:aspect-[1304/1244]' : 'aspect-[1304/1244]'} w-full overflow-hidden rounded-xl border border-[#00ff85]/35 bg-[#210025] shadow-[0_30px_80px_-34px_rgba(21,0,25,0.78)] [container-type:inline-size] sm:rounded-2xl ${className}`}
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
					className="pointer-events-none absolute inset-x-[-18%] top-[49%] z-[1] flex -translate-y-1/2 -rotate-[9deg] items-center justify-center whitespace-nowrap select-none opacity-[0.2]"
				>
					<div className="flex items-center gap-[clamp(0.45rem,2.2cqi,1.4rem)] text-[#f8f6ef] [text-shadow:0_2px_10px_rgba(0,0,0,0.22)]">
						<LogoMark className="size-[clamp(1.8rem,7cqi,4.4rem)] text-electric" />
						<div className="flex flex-col gap-[clamp(0.16rem,0.6cqi,0.35rem)]">
							<LogoWordmark className="text-[clamp(1.35rem,6cqi,4rem)] tracking-[0.16em]" />
							<span className="font-mono text-[clamp(0.42rem,1.25cqi,0.78rem)] font-semibold uppercase tracking-[0.28em] text-[#00ff85]">
								letletme.top
							</span>
						</div>
					</div>
				</div>

				{POSITION_ORDER.map(position => (
					<PositionRow
						key={position}
						position={position}
						players={players.filter(player => player.position === position)}
						benchVisible={benchPlayers.length > 0}
						onPlayerClick={onPlayerClick}
					/>
				))}

				{benchPlayers.length > 0 ? (
					<div className="absolute inset-x-[5.2%] bottom-[1%] z-20 rounded-[clamp(0.35rem,1.1cqi,0.7rem)] border border-[#38003c]/15 bg-[#b8d9b9]/90 px-[clamp(0.35rem,1.2cqi,0.75rem)] py-[clamp(0.3rem,1cqi,0.6rem)] shadow-[0_12px_24px_rgba(0,37,23,0.22)]">
						<div className="mb-[clamp(0.25rem,0.8cqi,0.5rem)] flex items-center justify-between gap-2">
							<h3 className="font-display text-[clamp(0.45rem,1.2cqi,0.72rem)] font-bold uppercase tracking-[0.12em] text-[#38003c]">
								{benchTitle}
							</h3>
							{benchBoost ? (
								<span className="rounded-[0.2rem] bg-[#38003c] px-[clamp(0.18rem,0.6cqi,0.4rem)] py-[clamp(0.08rem,0.25cqi,0.16rem)] font-mono text-[clamp(0.42rem,1cqi,0.62rem)] font-bold uppercase tracking-wider text-[#00ff85]">
									{benchBoostLabel}
								</span>
							) : null}
						</div>
						<ol className="grid grid-cols-4 gap-[clamp(0.25rem,1cqi,0.65rem)]">
							{benchPlayers.map((player, index) => {
								const outfieldIndex =
									benchPlayers
										.slice(0, index)
										.filter(item => item.position !== 'GKP').length + 1
								const label =
									player.position === 'GKP'
										? 'GKP'
										: `${outfieldIndex}. ${player.position}`
								return (
									<BenchPlayerCard
										key={player.id}
										player={player}
										label={label}
										pointsLabel={benchPointsLabel}
									/>
								)
							})}
						</ol>
					</div>
				) : null}
			</section>
		)
	}
)
