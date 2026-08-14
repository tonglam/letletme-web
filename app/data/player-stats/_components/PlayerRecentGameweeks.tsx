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
	PlayerRecentGameweek
} from '@/lib/graphql/operations/players'
import { useTranslations } from 'next-intl'

function opponentLabel(
	row: PlayerRecentGameweek,
	homeShort: string,
	awayShort: string
): string {
	if (row.opponents.length === 0) return '—'
	return row.opponents
		.map(opponent =>
			`${opponent.wasHome ? homeShort : awayShort} ${opponent.teamShortName}`.trim()
		)
		.join(' / ')
}

function positionDetails(
	row: PlayerRecentGameweek,
	elementType: number,
	labels: {
		goals: string
		assists: string
		cleanSheets: string
		saves: string
	}
): string[] {
	switch (elementType) {
		case 1:
			return [
				`${labels.saves} ${row.saves ?? '—'}`,
				`${labels.cleanSheets} ${row.cleanSheets ?? '—'}`
			]
		case 2:
			return [
				`${labels.goals} ${row.goalsScored ?? '—'}`,
				`${labels.assists} ${row.assists ?? '—'}`,
				`${labels.cleanSheets} ${row.cleanSheets ?? '—'}`
			]
		case 3:
		case 4:
			return [
				`${labels.goals} ${row.goalsScored ?? '—'}`,
				`${labels.assists} ${row.assists ?? '—'}`
			]
		default:
			return []
	}
}

function RecentCompareCell({
	row,
	elementType,
	includePositionDetails,
	pointsWin = false,
	bonusWin = false
}: {
	row: PlayerRecentGameweek | null
	elementType: number
	includePositionDetails: boolean
	pointsWin?: boolean
	bonusWin?: boolean
}) {
	const t = useTranslations('PlayerStats')
	const tl = useTranslations('PlayerStats.labels')
	if (!row) return <span className="text-muted-foreground">—</span>

	const details = includePositionDetails
		? positionDetails(row, elementType, {
				goals: tl('goals'),
				assists: tl('assists'),
				cleanSheets: tl('cleanSheets'),
				saves: tl('saves')
			})
		: []

	return (
		<div className="space-y-1">
			<p className="font-medium">
				{opponentLabel(row, t('homeShort'), t('awayShort'))}
			</p>
			<p className="text-xs tabular-nums text-muted-foreground">
				<span className={pointsWin ? 'text-primary-ink' : undefined}>
					{tl('points')} {row.totalPoints}
				</span>{' '}
				· {tl('minutes')} {row.minutes ?? '—'} ·{' '}
				{row.started == null ? '—' : row.started ? t('started') : t('bench')} ·{' '}
				<span className={bonusWin ? 'text-primary-ink' : undefined}>
					{tl('bonus')} {row.bonus ?? '—'}
				</span>
			</p>
			{details.length > 0 ? (
				<p className="text-xs tabular-nums text-muted-foreground">
					{details.join(' · ')}
				</p>
			) : null}
		</div>
	)
}

export function PlayerRecentGameweeks({
	player,
	comparison
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
}) {
	const t = useTranslations('PlayerStats')
	const tl = useTranslations('PlayerStats.labels')
	const firstByEvent = new Map(
		player.recentGameweeks.map(row => [row.eventId, row])
	)
	const secondByEvent = new Map(
		(comparison?.recentGameweeks ?? []).map(row => [row.eventId, row])
	)
	const events = Array.from(
		new Set([
			...Array.from(firstByEvent.keys()),
			...Array.from(secondByEvent.keys())
		])
	)
		.sort((a, b) => b - a)
		.slice(0, 5)

	if (events.length === 0) {
		return <p className="text-sm text-muted-foreground">{t('recentEmpty')}</p>
	}

	if (comparison) {
		const samePosition = player.elementType === comparison.elementType
		return (
			<DataTable minWidthClass="min-w-[32rem]">
				<DataThead>
					<DataTh className="pr-3">{t('fixturesColGw')}</DataTh>
					<DataTh className="pr-3">{player.webName}</DataTh>
					<DataTh>{comparison.webName}</DataTh>
				</DataThead>
				<tbody>
					{events.map(eventId => {
						const first = firstByEvent.get(eventId) ?? null
						const second = secondByEvent.get(eventId) ?? null
						const provisional = Boolean(
							first?.provisional || second?.provisional
						)
						const firstPointsWin = Boolean(
							samePosition &&
							first &&
							second &&
							first.totalPoints > second.totalPoints
						)
						const secondPointsWin = Boolean(
							samePosition &&
							first &&
							second &&
							second.totalPoints > first.totalPoints
						)
						const firstBonusWin = Boolean(
							samePosition &&
							first?.bonus != null &&
							second?.bonus != null &&
							first.bonus > second.bonus
						)
						const secondBonusWin = Boolean(
							samePosition &&
							first?.bonus != null &&
							second?.bonus != null &&
							second.bonus > first.bonus
						)
						return (
							<DataTr key={eventId}>
								<DataTd className="whitespace-nowrap py-2.5 pr-3 align-top tabular-nums text-muted-foreground">
									<span className="inline-flex items-center gap-1.5">
										{t('gameweekShort', { gameweek: eventId })}
										{provisional ? (
											<Badge
												variant="secondary"
												className="h-3.5 px-1 text-micro leading-none"
											>
												{t('provisional')}
											</Badge>
										) : null}
									</span>
								</DataTd>
								<DataTd className="py-2.5 pr-3 align-top">
									<RecentCompareCell
										row={first}
										elementType={player.elementType}
										includePositionDetails={samePosition}
										pointsWin={firstPointsWin}
										bonusWin={firstBonusWin}
									/>
								</DataTd>
								<DataTd className="py-2.5 align-top">
									<RecentCompareCell
										row={second}
										elementType={comparison.elementType}
										includePositionDetails={samePosition}
										pointsWin={secondPointsWin}
										bonusWin={secondBonusWin}
									/>
								</DataTd>
							</DataTr>
						)
					})}
				</tbody>
			</DataTable>
		)
	}

	return (
		<DataTable minWidthClass="min-w-[42rem]">
			<DataThead>
				<DataTh className="pr-3">{t('fixturesColGw')}</DataTh>
				<DataTh className="pr-3">
					{t('fixturesColOpponent')}
				</DataTh>
				<DataTh className="pr-3">{tl('points')}</DataTh>
				<DataTh className="pr-3">{tl('minutes')}</DataTh>
				<DataTh className="pr-3">{tl('starts')}</DataTh>
				<DataTh className="pr-3">{tl('bonus')}</DataTh>
				<DataTh>{t('positionOutput')}</DataTh>
			</DataThead>
			<tbody>
				{events.map(eventId => {
					const row = firstByEvent.get(eventId)
					if (!row) return null
					const details = positionDetails(row, player.elementType, {
						goals: tl('goals'),
						assists: tl('assists'),
						cleanSheets: tl('cleanSheets'),
						saves: tl('saves')
					})
					return (
						<DataTr key={eventId}>
							<DataTd className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									{t('gameweekShort', { gameweek: eventId })}
									{row.provisional ? (
										<Badge
											variant="secondary"
											className="h-3.5 px-1 text-micro leading-none"
										>
											{t('provisional')}
										</Badge>
									) : null}
								</span>
							</DataTd>
							<DataTd className="py-2.5 pr-3 font-medium">
								{opponentLabel(row, t('homeShort'), t('awayShort'))}
							</DataTd>
							<DataTd className="py-2.5 pr-3 tabular-nums">{row.totalPoints}</DataTd>
							<DataTd className="py-2.5 pr-3 tabular-nums">
								{row.minutes ?? '—'}
							</DataTd>
							<DataTd className="py-2.5 pr-3">
								{row.started == null
									? '—'
									: row.started
										? t('started')
										: t('bench')}
							</DataTd>
							<DataTd className="py-2.5 pr-3 tabular-nums">{row.bonus ?? '—'}</DataTd>
							<DataTd className="py-2.5 text-xs text-muted-foreground">
								{details.join(' · ')}
							</DataTd>
						</DataTr>
					)
				})}
			</tbody>
		</DataTable>
	)
}
