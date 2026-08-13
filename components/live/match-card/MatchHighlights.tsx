import type { LucideIcon } from 'lucide-react'
import {
	BarChart2,
	Goal,
	Hand,
	Handshake,
	Shield,
	Star,
} from 'lucide-react'
import type { MatchHighlightGroup, MatchHighlightKind } from './match-card-model'
import { useTranslations } from 'next-intl'

/** Prefer football-literal icons over abstract glyphs. */
const ICONS: Partial<Record<MatchHighlightKind, LucideIcon>> = {
	goals: Goal,
	assists: Handshake,
	bonus: Star,
	bps: BarChart2,
	defensive: Shield,
	saves: Hand,
	// yellow / red use CardGlyph (true card colours)
}

const TONES: Record<MatchHighlightKind, string> = {
	bonus: 'text-warning',
	goals: 'text-success',
	assists: 'text-info',
	defensive: 'text-info',
	bps: 'text-primary-ink',
	saves: 'text-info',
	// Card text tones use theme warning/destructive; the literal card
	// colours live on CardGlyph's fills only.
	yellow: 'text-warning',
	red: 'text-destructive',
}

const ICON_BG: Record<MatchHighlightKind, string> = {
	bonus: 'bg-warning/15',
	goals: 'bg-success/15',
	assists: 'bg-info/15',
	defensive: 'bg-info/15',
	bps: 'bg-primary/10',
	saves: 'bg-info/15',
	yellow: 'bg-warning/15',
	red: 'bg-destructive/15',
}

const EDGE: Record<MatchHighlightKind, string> = {
	bonus: 'border-l-warning',
	goals: 'border-l-success',
	assists: 'border-l-info',
	defensive: 'border-l-info',
	bps: 'border-l-primary',
	saves: 'border-l-info',
	yellow: 'border-l-warning',
	red: 'border-l-destructive',
}

/** Solid yellow / red card glyph (matches real card colours). */
function CardGlyph({ kind }: { kind: 'yellow' | 'red' }) {
	const fill = kind === 'yellow' ? 'bg-yellow-400' : 'bg-red-600'
	const ring =
		kind === 'yellow'
			? 'ring-1 ring-yellow-600/40'
			: 'ring-1 ring-red-800/40'
	return (
		<span
			className={`inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] shadow-sm ${fill} ${ring}`}
			aria-hidden="true"
		/>
	)
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
		<section aria-label={t('matchHighlights')} className="flex flex-col gap-2.5">
			{groups.map(group => {
				const Icon = ICONS[group.kind]
				const isCard = group.kind === 'yellow' || group.kind === 'red'
				return (
					<div
						key={group.kind}
						className={`rounded-md border border-border/50 border-l-[3px] bg-accent/20 p-3 ${EDGE[group.kind]}`}
					>
						<h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
							<span
								className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md ${ICON_BG[group.kind]}`}
								title={titles[group.kind]}
							>
								{group.kind === 'yellow' || group.kind === 'red' ? (
									<CardGlyph kind={group.kind} />
								) : Icon ? (
									<Icon
										className={`size-3.5 ${TONES[group.kind]}`}
										aria-hidden="true"
									/>
								) : null}
							</span>
							<span className={TONES[group.kind]}>{titles[group.kind]}</span>
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{group.items.map((item, index) => (
								<span
									key={`${item.player}-${item.team}-${index}`}
									className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/90 px-2.5 py-1 text-xs"
								>
									{group.kind === 'yellow' || group.kind === 'red' ? (
										<CardGlyph kind={group.kind} />
									) : null}
									<span className="font-medium">{item.player}</span>
									<span className="text-muted-foreground">({item.team})</span>
									<span
										className={`font-bold tabular-nums ${TONES[group.kind]}`}
									>
										{formatValue(group.kind, item.value)}
									</span>
								</span>
							))}
						</div>
					</div>
				)
			})}
		</section>
	)
}
