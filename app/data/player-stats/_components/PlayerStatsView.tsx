import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { StatsTabsShell } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
	PlayerDetailData,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PlayerFixturesTab } from './PlayerFixturesTab'
import { PlayerIctTab } from './PlayerIctTab'
import { PlayerOverviewTab } from './PlayerOverviewTab'
import { PlayerSeasonTab } from './PlayerSeasonTab'
import { PlayerStateTab } from './PlayerStateTab'
import {
	formatPrice,
	formatPriceDiff,
	PlayerDetailSkeleton,
	PlayerMiniCard,
	StatCell
} from './PlayerStatPrimitives'

interface PlayerStatsViewProps {
	selectedPlayer: PlayerDirectoryOption | null
	selectedComparison: PlayerDirectoryOption | null
	player: PlayerDetailData | null
	comparison: PlayerDetailData | null
	playerState: PlayerStateProfileData | null
	comparisonState: PlayerStateProfileData | null
	isLoading: boolean
	isComparisonLoading: boolean
	isStateLoading: boolean
	isComparisonStateLoading: boolean
	error: string | null
	comparisonError: string | null
	stateError: string | null
	comparisonStateError: string | null
	onRequestState: () => void
	onRequestComparisonState: () => void
	currentGameweek?: number
}

function SinglePlayerHeader({
	player,
	currentGameweek
}: {
	player: PlayerDetailData
	currentGameweek?: number
}) {
	const t = useTranslations('PlayerStats.labels')
	const position = useTranslations('PlayerDirectory')
	const priceDiff = formatPriceDiff(player.price, player.startPrice)
	const positionName =
		player.elementType === 1
			? position('goalkeeper')
			: player.elementType === 2
				? position('defender')
				: player.elementType === 3
					? position('midfielder')
					: player.elementType === 4
						? position('forward')
						: player.elementTypeName

	return (
		<Card className="mb-6 border-border/80 p-4 shadow-sm sm:p-5">
			<div className="mb-1 flex items-center gap-2">
				<h2 className="font-display text-2xl font-bold tracking-tight">
					{player.webName}
				</h2>
				<Badge
					variant="outline"
					className="text-xs"
				>
					{positionName}
				</Badge>
			</div>
			<p className="mb-4 text-sm text-muted-foreground">
				{player.teamShortName}
			</p>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<StatCell
					label={t('price')}
					value={formatPrice(player.price)}
					sub={priceDiff ?? undefined}
				/>
				<StatCell
					label={t('gwPoints', { gameweek: currentGameweek ?? '—' })}
					value={player.eventPoints}
				/>
				<StatCell
					label={t('totalPts')}
					value={player.totalPoints}
				/>
				<StatCell
					label={t('selected')}
					value={
						player.selectedByPercent == null
							? '—'
							: `${player.selectedByPercent}%`
					}
				/>
				<StatCell
					label={t('form')}
					value={player.form ?? '—'}
				/>
			</div>
		</Card>
	)
}

function ComparisonHeader({
	player,
	comparison,
	currentGameweek
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData
	currentGameweek?: number
}) {
	return (
		<>
			<div className="mb-6 grid grid-cols-2 gap-3">
				<PlayerMiniCard
					detail={player}
					currentGameweek={currentGameweek}
					accent="info"
				/>
				<PlayerMiniCard
					detail={comparison}
					currentGameweek={currentGameweek}
					accent="warning"
				/>
			</div>
			<div className="mb-2 grid grid-cols-3 px-1 text-sm font-semibold">
				<span className="truncate pr-4 text-right text-info">
					{player.webName}
				</span>
				<span />
				<span className="truncate pl-4 text-left text-warning">
					{comparison.webName}
				</span>
			</div>
		</>
	)
}

export function PlayerStatsView({
	selectedPlayer,
	selectedComparison,
	player,
	comparison,
	playerState,
	comparisonState,
	isLoading,
	isComparisonLoading,
	isStateLoading,
	isComparisonStateLoading,
	error,
	comparisonError,
	stateError,
	comparisonStateError,
	onRequestState,
	onRequestComparisonState,
	currentGameweek
}: PlayerStatsViewProps) {
	const t = useTranslations('PlayerStats')

	if (!selectedPlayer) {
		return (
			<Card className="border-border/80 p-8 text-center shadow-sm">
				<User className="mx-auto mb-4 size-12 text-muted-foreground" />
				<h2 className="font-display text-lg font-medium">
					{t('selectPrompt')}
				</h2>
				<p className="mt-2 text-sm text-muted-foreground">{t('selectHelp')}</p>
			</Card>
		)
	}

	if (isLoading || (selectedComparison && isComparisonLoading))
		return <PlayerDetailSkeleton />

	if (error || comparisonError) {
		return (
			<Card
				className="border-border/80 p-8 text-center shadow-sm"
				role="alert"
			>
				<p className="text-sm text-destructive">{error ?? comparisonError}</p>
			</Card>
		)
	}

	if (!player) return null

	return (
		<>
			{comparison ? (
				<ComparisonHeader
					player={player}
					comparison={comparison}
					currentGameweek={currentGameweek}
				/>
			) : (
				<SinglePlayerHeader
					player={player}
					currentGameweek={currentGameweek}
				/>
			)}
			<Tabs
				key={`${selectedPlayer.id}:${selectedComparison?.id ?? ''}`}
				defaultValue="overview"
				className="space-y-5"
				onValueChange={value => {
					if (value !== 'state') return
					onRequestState()
					if (selectedComparison) onRequestComparisonState()
				}}
			>
				<StatsTabsShell>
					<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-5 sm:gap-2">
						<TabsTrigger value="overview">{t('overview')}</TabsTrigger>
						<TabsTrigger value="season">{t('season')}</TabsTrigger>
						<TabsTrigger value="ict">{t('ict')}</TabsTrigger>
						<TabsTrigger value="fixtures">{t('fixtures')}</TabsTrigger>
						<TabsTrigger value="state">{t('state.tab')}</TabsTrigger>
					</TabsList>
				</StatsTabsShell>
				<TabsContent
					value="overview"
					className="mt-0"
				>
					<PlayerOverviewTab
						player={player}
						comparison={comparison}
						currentGameweek={currentGameweek}
					/>
				</TabsContent>
				<TabsContent
					value="season"
					className="mt-0"
				>
					<PlayerSeasonTab
						player={player}
						comparison={comparison}
					/>
				</TabsContent>
				<TabsContent
					value="ict"
					className="mt-0"
				>
					<PlayerIctTab
						player={player}
						comparison={comparison}
					/>
				</TabsContent>
				<TabsContent
					value="fixtures"
					className="mt-0"
				>
					<PlayerFixturesTab
						player={player}
						comparison={comparison}
						currentGameweek={currentGameweek}
					/>
				</TabsContent>
				<TabsContent
					value="state"
					className="mt-0"
				>
					<PlayerStateTab
						player={{
							name: player.webName,
							profile: playerState,
							isLoading: isStateLoading,
							error: stateError
						}}
						comparison={
							selectedComparison
								? {
										name: comparison?.webName ?? selectedComparison.name,
										profile: comparisonState,
										isLoading: isComparisonStateLoading,
										error: comparisonStateError
									}
								: null
						}
					/>
				</TabsContent>
			</Tabs>
		</>
	)
}
