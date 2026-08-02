import { PlayerList, type PlayerListItem } from '@/components/player/PlayerList'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_SCORES,
	type LiveScoresResponse,
} from '@/lib/graphql/operations/live'
import { normalizePosition } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface TeamOfTheWeekSectionProps {
	currentEventId: number | null
}

export function TeamOfTheWeekSectionFallback({ currentEventId }: TeamOfTheWeekSectionProps) {
	return (
		<TeamOfTheWeekCard
			currentEventId={currentEventId}
			teamOfTheWeek={[]}
			isLoading
		/>
	)
}

function TeamOfTheWeekCard({
	currentEventId,
	teamOfTheWeek,
	isLoading = false,
	hasError,
}: TeamOfTheWeekSectionProps & {
	teamOfTheWeek: PlayerListItem[]
	isLoading?: boolean
	hasError?: boolean
}) {
	const t = useTranslations('Home')
	return (
		<Card className="rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8">
			<div className="mb-6 flex items-center justify-between">
				<h2 className="flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					<span className="rounded-md bg-plum px-2 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
						{currentEventId ? `GW${currentEventId}` : 'GW'}
					</span>
					<span>{t('teamOfWeek')}</span>
				</h2>
				{teamOfTheWeek.length > 0 && !isLoading && (
					<Badge variant="secondary">{t('playerCount', { count: teamOfTheWeek.length })}</Badge>
				)}
			</div>

			{hasError && (
				<div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
					<p className="text-sm text-destructive">{t('teamOfWeekFailed')}</p>
				</div>
			)}

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 11 }).map((_, i) => (
						<Skeleton
							key={i}
							className="h-14 w-full rounded-lg"
						/>
					))}
				</div>
			) : (
				<PlayerList
					players={teamOfTheWeek}
					emptyText={t('noTeamOfWeek')}
				/>
			)}
		</Card>
	)
}

export async function TeamOfTheWeekSection({ currentEventId }: TeamOfTheWeekSectionProps) {
	if (!currentEventId) {
		return (
			<TeamOfTheWeekCard
				currentEventId={currentEventId}
				teamOfTheWeek={[]}
			/>
		)
	}

	let players: PlayerListItem[] = []
	let hasError = false

	try {
		const scoresData = await executePublicServerQuery<LiveScoresResponse>(
			GET_LIVE_SCORES,
			{ eventId: currentEventId },
			{ cache: 'force-cache', next: { revalidate: 300 }, timeoutMs: 5_000 },
		)

		const positionOrder: Record<string, number> = {
			GKP: 0,
			DEF: 1,
			MID: 2,
			FWD: 3,
		}

		players = scoresData.liveScores
			.filter(s => s.inDreamTeam)
			.map(s => ({
				id: s.player.id,
				position: normalizePosition(s.player.position),
				name: s.player.webName,
				team: s.player.team?.shortName ?? s.player.team?.name ?? '',
				points: s.totalPoints,
			}))
			.sort((a, b) => {
				const orderDiff =
					(positionOrder[a.position] ?? 99) - (positionOrder[b.position] ?? 99)
				return orderDiff !== 0 ? orderDiff : (b.points ?? 0) - (a.points ?? 0)
			})
	} catch (err) {
		console.error('Failed to fetch team of the week:', err)
		hasError = true
	}

	return (
		<TeamOfTheWeekCard
			currentEventId={currentEventId}
			teamOfTheWeek={players}
			hasError={hasError}
		/>
	)
}
