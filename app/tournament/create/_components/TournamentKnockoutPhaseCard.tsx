import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { KNOCKOUT_FORMATS, type TournamentFormData, type TournamentPlan } from '../_lib/tournament-form'
import { TournamentPlanMetric } from './TournamentPlanMetric'
import { useTranslations } from 'next-intl'

export function TournamentKnockoutPhaseCard({ knockoutFormat, plan }: { knockoutFormat: 'none' | 'single' | 'double'; plan: TournamentPlan }) {
	const t = useTranslations('TournamentCreate')
	const { control } = useFormContext<TournamentFormData>()
	const display = (value: string | number) => knockoutFormat === 'none' ? '—' : value
	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">{t('knockoutPhase')}</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label htmlFor="knockout-format">{t('knockoutMode')} <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller name="knockoutFormat" control={control} render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="knockout-format"><SelectValue placeholder={t('selectFormat')} /></SelectTrigger><SelectContent><SelectGroup>{KNOCKOUT_FORMATS.map((format) => <SelectItem key={format.value} value={format.value}>{format.value === 'none' ? t('noKnockout') : format.value === 'single' ? t('singleElimination') : t('doubleElimination')}</SelectItem>)}</SelectGroup></SelectContent></Select>
					)} />
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					<TournamentPlanMetric label={t('knockoutTeams')} value={display(plan.knockoutTeamCount)} />
					<TournamentPlanMetric label={t('bracketSlots')} value={display(plan.knockoutBracketSize)} />
					<TournamentPlanMetric label={t('firstRoundByes')} value={display(plan.knockoutByeCount)} />
					<TournamentPlanMetric label={t('startGameweek')} value={display(plan.knockoutStart > 0 ? t('gameweekShort', { gameweek: plan.knockoutStart }) : '—')} />
					<TournamentPlanMetric label={t('endGameweek')} value={display(plan.knockoutEnd > 0 ? t('gameweekShort', { gameweek: plan.knockoutEnd }) : '—')} />
					<TournamentPlanMetric label={t('rounds')} value={display(plan.knockoutRounds)} />
					<TournamentPlanMetric label={t('eliminationStages')} value={display(plan.knockoutEventCount)} />
					<TournamentPlanMetric label={t('meetingsPerTie')} value={display(plan.knockoutPlayAgainstCount)} />
				</div>

				{knockoutFormat !== 'none' && plan.knockoutTeamCount < 2 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{t('knockoutMinimum')}</AlertDescription></Alert> : null}
				{knockoutFormat !== 'none' && plan.knockoutEnd > 38 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{t('knockoutOverrun')}</AlertDescription></Alert> : null}
			</div>
		</Card>
	)
}
