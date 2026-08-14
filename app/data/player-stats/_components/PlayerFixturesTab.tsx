import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr
} from '@/components/data/DataTable'
import { Badge } from '@/components/ui/badge'
import type {
	PlayerDetailData,
	PlayerDetailFixture
} from '@/lib/graphql/operations/players'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { DIFFICULTY_COLORS } from './PlayerStatPrimitives'

const UPCOMING_LIMIT = 8

export function groupFixturesByGameweek(fixtures: PlayerDetailFixture[]) {
	const grouped = new Map<number, PlayerDetailFixture[]>()
	for (const fixture of fixtures) {
		const gameweekFixtures = grouped.get(fixture.event) ?? []
		gameweekFixtures.push(fixture)
		grouped.set(fixture.event, gameweekFixtures)
	}
	return grouped
}

function upcomingGameweeks(
	fixtures: PlayerDetailFixture[],
	fromGameweek: number
): number[] {
	const grouped = groupFixturesByGameweek(fixtures)
	return Array.from(grouped.keys())
		.filter(gw => gw >= fromGameweek)
		.sort((a, b) => a - b)
		.slice(0, UPCOMING_LIMIT)
}

function FixtureChip({
	fixture,
	emphasized = false
}: {
	fixture: PlayerDetailFixture
	emphasized?: boolean
}) {
	const t = useTranslations('PlayerStats')
	const blank = fixture.bgw

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 text-sm',
				emphasized && 'text-primary-ink'
			)}
		>
			{blank ? (
				<span className="font-medium text-warning">BGW</span>
			) : (
				<>
					<span
						className={cn(
							'size-1.5 shrink-0 rounded-full',
							DIFFICULTY_COLORS[fixture.difficulty] ?? 'bg-muted'
						)}
						aria-hidden="true"
					/>
					<span className="font-medium">
						{fixture.wasHome ? t('homeShort') : t('awayShort')}{' '}
						{fixture.againstTeamShortName}
					</span>
					<span className="tabular-nums text-muted-foreground">
						{t('difficultyShort', { difficulty: fixture.difficulty })}
					</span>
				</>
			)}
		</span>
	)
}

function averageFdr(fixtures: PlayerDetailFixture[]): number | null {
	const values = fixtures
		.filter(fixture => !fixture.bgw && fixture.difficulty > 0)
		.map(fixture => fixture.difficulty)
	if (values.length === 0) return null
	return values.reduce((total, value) => total + value, 0) / values.length
}

function UpcomingRun({
	player,
	comparison,
	currentGameweek
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	currentGameweek: number
}) {
	const t = useTranslations('PlayerStats')
	const firstByGw = groupFixturesByGameweek(player.fixtures)
	const secondByGw = comparison
		? groupFixturesByGameweek(comparison.fixtures)
		: null

	const gameweeks = Array.from(
		new Set([
			...upcomingGameweeks(player.fixtures, currentGameweek),
			...(comparison
				? upcomingGameweeks(comparison.fixtures, currentGameweek)
				: [])
		])
	)
		.sort((a, b) => a - b)
		.slice(0, UPCOMING_LIMIT)

	if (gameweeks.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('nextFixturesEmpty')}</p>
		)
	}

	return (
		<DataTable minWidthClass="min-w-[20rem]">
			<DataThead>
				<DataTh className="pr-3">{t('fixturesColGw')}</DataTh>
				<DataTh className="pr-3">
					{comparison ? player.webName : t('fixturesColOpponent')}
				</DataTh>
				{comparison ? (
					<DataTh>{comparison.webName}</DataTh>
				) : null}
			</DataThead>
			<tbody>
				{gameweeks.map(gameweek => {
					const first = firstByGw.get(gameweek) ?? []
					const second = secondByGw?.get(gameweek) ?? []
					const isDouble = first.length > 1 || second.length > 1
					const isCurrent = gameweek === currentGameweek
					const firstFdr = averageFdr(first)
					const secondFdr = averageFdr(second)
					const firstFdrWins = Boolean(
						comparison?.elementType === player.elementType &&
						firstFdr != null &&
						secondFdr != null &&
						firstFdr < secondFdr
					)
					const secondFdrWins = Boolean(
						comparison?.elementType === player.elementType &&
						firstFdr != null &&
						secondFdr != null &&
						secondFdr < firstFdr
					)

					return (
						<DataTr
							key={gameweek}
							className={cn(isCurrent && 'bg-muted/40')}
						>
							<DataTd className="whitespace-nowrap py-2.5 pr-3 align-top tabular-nums text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									{t('gameweekShort', { gameweek })}
									{isDouble ? (
										<Badge
											variant="secondary"
											className="h-3.5 px-1 text-micro leading-none"
										>
											DGW
										</Badge>
									) : null}
								</span>
							</DataTd>
							<DataTd className="py-2.5 pr-3 align-top">
								<div className="flex flex-col gap-1">
									{first.length === 0 ? (
										<span className="text-xs font-medium text-warning">
											BGW
										</span>
									) : (
										first.map((fixture, index) => (
											<FixtureChip
												key={fixture.id || `${fixture.event}-${index}`}
												fixture={fixture}
												emphasized={firstFdrWins}
											/>
										))
									)}
								</div>
							</DataTd>
							{comparison ? (
								<DataTd className="py-2.5 align-top">
									<div className="flex flex-col gap-1">
										{second.length === 0 ? (
											<span className="text-xs font-medium text-warning">
												BGW
											</span>
										) : (
											second.map((fixture, index) => (
												<FixtureChip
													key={fixture.id || `${fixture.event}-${index}`}
													fixture={fixture}
													emphasized={secondFdrWins}
												/>
											))
										)}
									</div>
								</DataTd>
							) : null}
						</DataTr>
					)
				})}
			</tbody>
		</DataTable>
	)
}

export function PlayerFixturesTab({
	player,
	comparison,
	currentGameweek
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	currentGameweek?: number
}) {
	const fromGw = currentGameweek ?? 1
	return (
		<UpcomingRun
			player={player}
			comparison={comparison}
			currentGameweek={fromGw}
		/>
	)
}
