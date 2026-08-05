import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarRange, Check, Link as LinkIcon, ListChecks, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import type {
	LeaguePreview,
	LeagueUrlValidation,
	TournamentFormData,
} from '../_lib/tournament-form'

export function ClassicLeagueImportCard({
	fetchParticipants,
	isLoading,
	leagueUrl,
	leagueUrlState,
	loadedLeague,
	participantCount,
	participantError,
}: {
	fetchParticipants: () => void
	isLoading: boolean
	leagueUrl: string
	leagueUrlState: LeagueUrlValidation
	loadedLeague: LeaguePreview | null
	participantCount: number
	participantError: string | null
}) {
	const t = useTranslations('TournamentCreate')
	const { formState: { errors }, register } = useFormContext<TournamentFormData>()
	const validationMessage = errors.leagueUrl?.message ?? participantError ?? (leagueUrl ? leagueUrlState.message : null)

	return (
		<Card className="mb-8 overflow-hidden p-0">
			<div className="border-b bg-primary/5 px-6 py-5">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-xl font-semibold">{t('copyClassicTitle')}</h2>
					<Badge variant="outline">{t('classic')}</Badge>
				</div>
				<p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('copyClassicHelp')}</p>
			</div>

			<div className="space-y-6 p-6">
				<section aria-labelledby="classic-link-steps-title" className="rounded-xl border bg-accent/20 p-4">
					<h3 id="classic-link-steps-title" className="flex items-center gap-2 text-sm font-semibold">
						<ListChecks aria-hidden="true" className="size-4 text-primary-ink" />
						{t('classicLinkStepsTitle')}
					</h3>
					<ol className="mt-3 grid gap-3 text-sm leading-5 text-muted-foreground sm:grid-cols-3">
						{[
							t('classicLinkStepOpen'),
							t('classicLinkStepLeague'),
							t('classicLinkStepCopy'),
						].map((step, index) => (
							<li key={step} className="flex items-start gap-2">
								<span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
									{index + 1}
								</span>
								<span>{step}</span>
							</li>
						))}
					</ol>
				</section>

				<div className="grid gap-3">
					<Label htmlFor="league-url">{t('classicLeagueUrl')} <span aria-hidden="true" className="text-destructive">*</span></Label>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start">
						<div className="min-w-0 flex-1">
							<Input
								id="league-url"
								{...register('leagueUrl')}
								placeholder="https://fantasy.premierleague.com/en/leagues/123456/standings/c"
								autoComplete="url"
								aria-invalid={Boolean(validationMessage)}
								aria-describedby="classic-league-url-help classic-league-url-error"
							/>
							<p id="classic-league-url-help" className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('classicLeagueUrlHelp')}
							</p>
							{validationMessage ? (
								<p id="classic-league-url-error" role="alert" className="mt-1 text-sm text-destructive">
									{validationMessage}
								</p>
							) : null}
						</div>
						<Button
							type="button"
							onClick={fetchParticipants}
							disabled={!leagueUrlState.valid || isLoading}
							className="sm:min-w-40"
						>
							<LinkIcon data-icon="inline-start" aria-hidden="true" />
							{isLoading ? t('checkingLeague') : t('checkLeague')}
						</Button>
					</div>
				</div>

				{loadedLeague ? (
					<div className="space-y-4" aria-live="polite">
						<Alert variant="success">
							<Check aria-hidden="true" />
							<AlertDescription>{t('classicReady', { name: loadedLeague.leagueName })}</AlertDescription>
						</Alert>

						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-xl border bg-accent/20 p-4 sm:col-span-2">
								<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
									<ShieldCheck aria-hidden="true" className="size-4" /> {t('officialLeague')}
								</div>
								<p className="mt-2 break-words font-semibold">{loadedLeague.leagueName}</p>
								<p className="mt-1 text-xs text-muted-foreground">FPL #{loadedLeague.leagueId}</p>
							</div>
							<div className="rounded-xl border p-4">
								<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
									<Users aria-hidden="true" className="size-4" /> {t('teams')}
								</div>
								<p className="mt-2 text-2xl font-semibold tabular-nums">{participantCount}</p>
							</div>
							<div className="rounded-xl border p-4">
								<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
									<CalendarRange aria-hidden="true" className="size-4" /> {t('gameweeks')}
								</div>
								<p className="mt-2 font-semibold">{t('gameweekRange', { start: loadedLeague.startEvent, end: 38 })}</p>
							</div>
						</div>

						<div className="flex items-start gap-3 rounded-lg bg-accent/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
							<RefreshCw aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-ink" />
							<p>{t('classicUpdateContract')}</p>
						</div>
					</div>
				) : null}
			</div>
		</Card>
	)
}
