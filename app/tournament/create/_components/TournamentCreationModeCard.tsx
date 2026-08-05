import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { Copy, SlidersHorizontal, Swords } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { TournamentCreationMode } from '../_lib/tournament-form'

export function TournamentCreationModeCard({
	mode,
	onModeChange,
}: {
	mode: TournamentCreationMode
	onModeChange: (mode: TournamentCreationMode) => void
}) {
	const t = useTranslations('TournamentCreate')

	return (
		<Card className="mb-8 overflow-hidden p-0">
			<div className="border-b bg-accent/20 px-6 py-5">
				<h2 className="text-xl font-semibold">{t('choosePath')}</h2>
				<p className="mt-1 text-sm leading-6 text-muted-foreground">{t('choosePathHelp')}</p>
			</div>
			<div className="p-6">
				<RadioGroup
					value={mode}
					onValueChange={(value) => onModeChange(value as TournamentCreationMode)}
					className="grid gap-3 md:grid-cols-2"
					aria-label={t('choosePath')}
				>
					<div>
						<RadioGroupItem value="classic" id="creation-mode-classic" className="peer sr-only" />
						<Label
							htmlFor="creation-mode-classic"
							className={cn(
								'flex h-full cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-accent/30',
								mode === 'classic' && 'border-primary bg-primary/5 ring-1 ring-primary',
							)}
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
								<Copy aria-hidden="true" className="size-5" />
							</span>
							<span>
								<span className="flex flex-wrap items-center gap-2 font-semibold">
									{t('classicPath')}
									<Badge>{t('recommended')}</Badge>
								</span>
								<span className="mt-1 block text-sm font-normal leading-6 text-muted-foreground">
									{t('classicPathHelp')}
								</span>
							</span>
						</Label>
					</div>

					<div>
						<RadioGroupItem value="custom" id="creation-mode-custom" className="peer sr-only" />
						<Label
							htmlFor="creation-mode-custom"
							className={cn(
								'flex h-full cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-accent/30',
								mode === 'custom' && 'border-primary bg-primary/5 ring-1 ring-primary',
							)}
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
								<SlidersHorizontal aria-hidden="true" className="size-5" />
							</span>
							<span>
								<span className="font-semibold">{t('customPath')}</span>
								<span className="mt-1 block text-sm font-normal leading-6 text-muted-foreground">
									{t('customPathHelp')}
								</span>
							</span>
						</Label>
					</div>
				</RadioGroup>

				<div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
					<Swords aria-hidden="true" className="size-4 shrink-0" />
					<span>{t('h2hReserved')}</span>
					<Badge variant="outline" className="ml-auto shrink-0">{t('comingLater')}</Badge>
				</div>
			</div>
		</Card>
	)
}
