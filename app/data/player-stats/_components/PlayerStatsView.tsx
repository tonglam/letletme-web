import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import { User } from 'lucide-react'
import { PlayerFixturesTab } from './PlayerFixturesTab'
import { PlayerIctTab } from './PlayerIctTab'
import { PlayerOverviewTab } from './PlayerOverviewTab'
import { PlayerSeasonTab } from './PlayerSeasonTab'
import {
	formatPrice,
	formatPriceDiff,
	PlayerDetailSkeleton,
	PlayerMiniCard,
	StatCell,
} from './PlayerStatPrimitives'

interface PlayerStatsViewProps {
	selectedPlayer: PlayerDirectoryOption | null
	selectedComparison: PlayerDirectoryOption | null
	player: PlayerDetailData | null
	comparison: PlayerDetailData | null
	isLoading: boolean
	isComparisonLoading: boolean
	error: string | null
	comparisonError: string | null
	currentGameweek?: number
}

function SinglePlayerHeader({ player, currentGameweek }: { player: PlayerDetailData; currentGameweek?: number }) {
	const priceDiff = formatPriceDiff(player.price, player.startPrice)

	return (
		<Card className="mb-6 p-5">
			<div className="mb-1 flex items-center gap-2">
				<h2 className="text-2xl font-bold">{player.webName}</h2>
				<Badge variant="outline" className="text-xs">{player.elementTypeName}</Badge>
			</div>
			<p className="mb-4 text-sm text-muted-foreground">{player.teamShortName}</p>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<StatCell label="Price" value={formatPrice(player.price)} sub={priceDiff ?? undefined} />
				<StatCell label={`GW ${currentGameweek ?? '—'} Pts`} value={player.eventPoints} />
				<StatCell label="Total Pts" value={player.totalPoints} />
				<StatCell label="Selected" value={player.selectedByPercent == null ? '—' : `${player.selectedByPercent}%`} />
				<StatCell label="Form" value={player.form ?? '—'} />
			</div>
		</Card>
	)
}

function ComparisonHeader({
	player,
	comparison,
	currentGameweek,
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData
	currentGameweek?: number
}) {
	return (
		<>
			<div className="mb-6 grid grid-cols-2 gap-3">
				<PlayerMiniCard detail={player} currentGameweek={currentGameweek} accent="info" />
				<PlayerMiniCard detail={comparison} currentGameweek={currentGameweek} accent="warning" />
			</div>
			<div className="mb-2 grid grid-cols-3 px-1 text-sm font-semibold">
				<span className="truncate pr-4 text-right text-info">{player.webName}</span>
				<span />
				<span className="truncate pl-4 text-left text-warning">{comparison.webName}</span>
			</div>
		</>
	)
}

export function PlayerStatsView({
	selectedPlayer,
	selectedComparison,
	player,
	comparison,
	isLoading,
	isComparisonLoading,
	error,
	comparisonError,
	currentGameweek,
}: PlayerStatsViewProps) {
	if (!selectedPlayer) {
		return (
			<Card className="p-8 text-center">
				<User className="mx-auto mb-4 size-12 text-muted-foreground" />
				<h2 className="text-lg font-medium">Select a player to view statistics</h2>
				<p className="mt-2 text-sm text-muted-foreground">Search by name or filter by team and position above.</p>
			</Card>
		)
	}

	if (isLoading || (selectedComparison && isComparisonLoading)) return <PlayerDetailSkeleton />

	if (error || comparisonError) {
		return (
			<Card className="p-8 text-center" role="alert">
				<p className="text-sm text-destructive">{error ?? comparisonError}</p>
			</Card>
		)
	}

	if (!player) return null

	return (
		<>
			{comparison ? (
				<ComparisonHeader player={player} comparison={comparison} currentGameweek={currentGameweek} />
			) : (
				<SinglePlayerHeader player={player} currentGameweek={currentGameweek} />
			)}
			<Tabs defaultValue="overview">
				<TabsList className="mb-6 grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="season">Season</TabsTrigger>
					<TabsTrigger value="ict">ICT</TabsTrigger>
					<TabsTrigger value="fixtures">Fixtures</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<PlayerOverviewTab player={player} comparison={comparison} currentGameweek={currentGameweek} />
				</TabsContent>
				<TabsContent value="season">
					<PlayerSeasonTab player={player} comparison={comparison} />
				</TabsContent>
				<TabsContent value="ict">
					<PlayerIctTab player={player} comparison={comparison} />
				</TabsContent>
				<TabsContent value="fixtures">
					<PlayerFixturesTab player={player} comparison={comparison} currentGameweek={currentGameweek} />
				</TabsContent>
			</Tabs>
		</>
	)
}
