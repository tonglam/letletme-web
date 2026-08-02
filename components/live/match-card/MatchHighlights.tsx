import { Activity, AlertTriangle, Award, BarChart2, Shield, Target, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MatchHighlightGroup, MatchHighlightKind } from './match-card-model'
import { useTranslations } from 'next-intl'

const ICONS: Record<MatchHighlightKind, LucideIcon> = {
	bonus: Award,
	goals: Target,
	assists: Activity,
	defensive: Shield,
	bps: BarChart2,
	saves: Shield,
	yellow: AlertTriangle,
	red: XCircle,
}

const TONES: Record<MatchHighlightKind, string> = {
	bonus: 'text-warning',
	goals: 'text-success',
	assists: 'text-info',
	defensive: 'text-info',
	bps: 'text-primary-ink',
	saves: 'text-info',
	yellow: 'text-warning',
	red: 'text-destructive',
}

function formatValue(kind: MatchHighlightKind, value: number) {
	if (kind === 'bonus') return `+${value}`
	return String(value)
}

export function MatchHighlights({ groups }: { groups: MatchHighlightGroup[] }) {
	const t = useTranslations('LiveMatches')
	const titles: Record<MatchHighlightKind, string> = {
		bonus: t('bonusPoints'),
		goals: t('goals'),
		assists: t('assists'),
		defensive: t('defensiveContribution'),
		bps: t('bps'),
		saves: t('saves'),
		yellow: t('yellowCards'),
		red: t('redCards'),
	}
	if (groups.length === 0) return null
	return (
		<section aria-label={t('matchHighlights')} className="flex flex-col gap-3">
			{groups.map((group) => {
				const Icon = ICONS[group.kind]
				return (
					<div key={group.kind} className="rounded-md bg-accent/30 p-3">
						<h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
							<Icon className={TONES[group.kind]} aria-hidden="true" /> {titles[group.kind]}
						</h3>
						<div className="flex flex-wrap gap-2">
							{group.items.map((item, index) => (
								<span key={`${item.player}-${item.team}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs">
									<span className="font-medium">{item.player}</span>
									<span className="text-muted-foreground">({item.team})</span>
									<span className={`font-bold ${TONES[group.kind]}`}>{formatValue(group.kind, item.value)}</span>
								</span>
							))}
						</div>
					</div>
				)
			})}
		</section>
	)
}
