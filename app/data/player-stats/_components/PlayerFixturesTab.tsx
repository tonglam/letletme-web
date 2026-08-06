import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PlayerDetailData, PlayerDetailFixture } from '@/lib/graphql/operations/players'
import { ArrowDownRight, ArrowUpRight, Calendar } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { DIFFICULTY_COLORS } from './PlayerStatPrimitives'

export function groupFixturesByGameweek(fixtures: PlayerDetailFixture[]) {
	const grouped = new Map<number, PlayerDetailFixture[]>()
	for (const fixture of fixtures) {
		const gameweekFixtures = grouped.get(fixture.event) ?? []
		gameweekFixtures.push(fixture)
		grouped.set(fixture.event, gameweekFixtures)
	}
	return grouped
}

function DifficultyDot({ difficulty }: { difficulty: number }) {
	const t = useTranslations('PlayerStats')

	return (
		<span
			className={`size-2 shrink-0 rounded-full ${DIFFICULTY_COLORS[difficulty] ?? 'bg-muted'}`}
			role="img"
			aria-label={t('fixtureDifficulty', { difficulty })}
			title={t('difficulty', { difficulty })}
		/>
	)
}

function FixtureStack({ fixtures }: { fixtures?: PlayerDetailFixture[] }) {
	const t = useTranslations('PlayerStats')

	if (!fixtures?.length) {
		return <span className="text-xs font-medium text-warning">BGW</span>
	}

	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			{fixtures.map((fixture, index) => (
				<div key={`${fixture.event}-${fixture.againstTeamShortName}-${fixture.kickoffTime ?? index}`} className="flex min-w-0 items-center gap-1.5">
					<span className="truncate text-xs font-medium">
						{fixture.againstTeamShortName} ({fixture.wasHome ? t('homeShort') : t('awayShort')})
					</span>
					{fixture.finished && fixture.score ? (
						<span className="shrink-0 font-mono text-[10px]">{fixture.score}</span>
					) : null}
					<DifficultyDot difficulty={fixture.difficulty} />
				</div>
			))}
		</div>
	)
}

function ComparisonFixtures({
	player,
	comparison,
	currentGameweek,
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData
	currentGameweek?: number
}) {
	const t = useTranslations('PlayerStats')
	const firstByGameweek = groupFixturesByGameweek(player.fixtures)
	const secondByGameweek = groupFixturesByGameweek(comparison.fixtures)
	const gameweeks = Array.from(
		new Set([...Array.from(firstByGameweek.keys()), ...Array.from(secondByGameweek.keys())]),
	).sort((a, b) => a - b)

	return (
		<Card className="border-border/80 p-4 shadow-sm sm:p-5">
			<h3 className="mb-4 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				<Calendar className="size-3.5 text-primary-ink" aria-hidden="true" />
				{t('fixtures')}
			</h3>
			<div className="mb-2 grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 text-sm font-semibold">
				<span />
				<span className="truncate text-info">{player.webName}</span>
				<span className="truncate text-warning">{comparison.webName}</span>
			</div>
			<div className="flex flex-col gap-0.5">
				{gameweeks.map((gameweek) => {
					const firstFixtures = firstByGameweek.get(gameweek)
					const secondFixtures = secondByGameweek.get(gameweek)
					const isDouble = (firstFixtures?.length ?? 0) > 1 || (secondFixtures?.length ?? 0) > 1
					const isCurrent = gameweek === currentGameweek

					return (
						<div
							key={gameweek}
							className={`grid grid-cols-[2rem_1fr_1fr] items-start gap-2 rounded-md px-2 py-1.5 ${
								isCurrent
									? 'border border-border bg-muted/50'
									: 'hover:bg-muted/40'
							}`}
						>
							<div className="flex flex-col items-start gap-0.5 pt-0.5">
								<span className="text-xs text-muted-foreground">{t('gameweekShort', { gameweek })}</span>
								{isDouble ? <Badge variant="secondary" className="h-3.5 px-1 text-[9px] leading-none">DGW</Badge> : null}
							</div>
							<FixtureStack fixtures={firstFixtures} />
							<FixtureStack fixtures={secondFixtures} />
						</div>
					)
				})}
			</div>
		</Card>
	)
}

function SinglePlayerFixtures({ player, currentGameweek }: { player: PlayerDetailData; currentGameweek?: number }) {
	const t = useTranslations('PlayerStats')
	const format = useFormatter()
	const fixturesByGameweek = groupFixturesByGameweek(player.fixtures)
	const gameweeks = Array.from(fixturesByGameweek.keys()).sort((a, b) => a - b)

	return (
		<Card className="border-border/80 p-4 shadow-sm sm:p-5">
			<h3 className="mb-4 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				<Calendar className="size-3.5 text-primary-ink" aria-hidden="true" />
				{t('allFixtures')}
			</h3>
			<div className="flex flex-col gap-1">
				{gameweeks.map((gameweek) => {
					const fixtures = fixturesByGameweek.get(gameweek) ?? []
					const isCurrent = gameweek === currentGameweek
					const isDouble = fixtures.length > 1
					const isBlank = fixtures.length === 1 && fixtures[0]?.bgw

					return (
						<div
							key={gameweek}
							className={`rounded-md px-3 py-2 text-sm ${
								isCurrent
									? 'border border-border bg-muted/50'
									: 'hover:bg-muted/40'
							}`}
						>
							<div className="mb-1 flex items-center gap-2">
								<span className="w-12 shrink-0 text-xs text-muted-foreground">{t('gameweekShort', { gameweek })}</span>
								{isDouble ? <Badge variant="secondary" className="h-3.5 px-1 text-[9px] leading-none">DGW</Badge> : null}
								{isBlank ? <Badge variant="outline" className="h-3.5 border-warning px-1 text-[9px] leading-none text-warning">BGW</Badge> : null}
							</div>
							{fixtures.map((fixture, index) => {
								const kickoff = fixture.kickoffTime
									? format.dateTime(new Date(fixture.kickoffTime), {
										day: '2-digit',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit',
										hourCycle: 'h23',
									})
									: '—'

								return (
									<div key={`${fixture.event}-${fixture.againstTeamShortName}-${fixture.kickoffTime ?? index}`} className="flex items-center justify-between">
										<div className="flex min-w-0 items-center gap-2">
											<span className="w-8 shrink-0" />
											<span className="truncate font-medium">
											{fixture.againstTeamShortName} ({fixture.wasHome ? t('homeShort') : t('awayShort')})
											</span>
										</div>
										<div className="ml-2 flex shrink-0 items-center gap-3">
											<span className="text-xs text-muted-foreground">{kickoff}</span>
											<span className="w-10 text-center font-mono text-xs font-semibold">
												{fixture.finished && fixture.score ? fixture.score : '—'}
											</span>
											<DifficultyDot difficulty={fixture.difficulty} />
										</div>
									</div>
								)
							})}
						</div>
					)
				})}
			</div>
			<Separator className="my-4" />
			<div className="flex items-center gap-4 text-xs text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<ArrowUpRight className="size-3 text-success" />
					{t('transfersIn', { count: format.number(player.seasonTransfersIn) })}
				</span>
				<span className="flex items-center gap-1.5">
					<ArrowDownRight className="size-3 text-destructive" />
					{t('transfersOut', { count: format.number(player.seasonTransfersOut) })}
				</span>
			</div>
		</Card>
	)
}

export function PlayerFixturesTab({
	player,
	comparison,
	currentGameweek,
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	currentGameweek?: number
}) {
	return comparison ? (
		<ComparisonFixtures player={player} comparison={comparison} currentGameweek={currentGameweek} />
	) : (
		<SinglePlayerFixtures player={player} currentGameweek={currentGameweek} />
	)
}
