import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { GAMEWEEKS, GROUP_FORMATS, type TournamentFormData, type TournamentPlan } from '../_lib/tournament-form'
import { TournamentPlanMetric } from './TournamentPlanMetric'
import { useTranslations } from 'next-intl'

interface TournamentGroupPhaseCardProps {
	groupFormat: 'none' | 'points'
	knockoutFormat: 'none' | 'single' | 'double'
	plan: TournamentPlan
}

export function TournamentGroupPhaseCard({ groupFormat, knockoutFormat, plan }: TournamentGroupPhaseCardProps) {
	const t = useTranslations('TournamentCreate')
	const { control, formState: { errors }, register } = useFormContext<TournamentFormData>()
	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">{t('groupPhase')}</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label htmlFor="group-format">{t('groupMode')} <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller name="groupFormat" control={control} render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger id="group-format"><SelectValue placeholder={t('selectFormat')} /></SelectTrigger>
							<SelectContent><SelectGroup>{GROUP_FORMATS.map((format) => <SelectItem key={format.value} value={format.value}>{format.value === 'none' ? t('noGroup') : t('pointsRace')}</SelectItem>)}</SelectGroup></SelectContent>
						</Select>
					)} />
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="grid gap-3">
						<Label htmlFor="start-gameweek">{t('startGameweek')} <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Controller name="startGameweek" control={control} render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="start-gameweek" aria-invalid={Boolean(errors.startGameweek)}><SelectValue placeholder={t('selectGameweek')} /></SelectTrigger><SelectContent><SelectGroup>{GAMEWEEKS.map((gameweek, index) => <SelectItem key={gameweek.value} value={gameweek.value}>{t('gameweek', { gameweek: index + 1 })}</SelectItem>)}</SelectGroup></SelectContent></Select>
						)} />
					</div>
					<div className="grid gap-3">
						<Label htmlFor="end-gameweek">{t('endGameweek')} <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Controller name="endGameweek" control={control} render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="end-gameweek" aria-invalid={Boolean(errors.endGameweek)} aria-describedby="end-gameweek-error"><SelectValue placeholder={t('selectGameweek')} /></SelectTrigger><SelectContent><SelectGroup>{GAMEWEEKS.map((gameweek, index) => <SelectItem key={gameweek.value} value={gameweek.value}>{t('gameweek', { gameweek: index + 1 })}</SelectItem>)}</SelectGroup></SelectContent></Select>
						)} />
						{errors.endGameweek ? <p id="end-gameweek-error" className="text-sm text-destructive">{errors.endGameweek.message}</p> : null}
					</div>
				</div>

				{groupFormat === 'points' ? (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="grid gap-3"><Label htmlFor="group-num">{t('groupNumber')} <span aria-hidden="true" className="text-destructive">*</span></Label><Input id="group-num" type="number" min="1" inputMode="numeric" {...register('groupNum')} aria-invalid={Boolean(errors.groupNum)} aria-describedby="group-num-error" />{errors.groupNum ? <p id="group-num-error" className="text-sm text-destructive">{errors.groupNum.message}</p> : null}</div>
						{knockoutFormat !== 'none' ? <div className="grid gap-3"><Label htmlFor="qualifiers-per-group">{t('qualifiersPerGroup')} <span aria-hidden="true" className="text-destructive">*</span></Label><Input id="qualifiers-per-group" type="number" min="1" inputMode="numeric" {...register('qualifiersPerGroup')} aria-invalid={Boolean(errors.qualifiersPerGroup)} aria-describedby="qualifiers-per-group-error" />{errors.qualifiersPerGroup ? <p id="qualifiers-per-group-error" className="text-sm text-destructive">{errors.qualifiersPerGroup.message}</p> : null}</div> : null}
					</div>
				) : null}

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<TournamentPlanMetric label={t('totalEntries')} value={plan.totalEntries} />
					<TournamentPlanMetric label={t('groupRounds')} value={plan.groupRounds} />
					<TournamentPlanMetric label={t('teamsPerGroup')} value={plan.groupTeamCount} />
					<TournamentPlanMetric label={t('groups')} value={groupFormat === 'points' ? plan.groupCount : 1} />
				</div>

				{plan.qualifyTotalExceedsEntries ? (
					<Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{t('qualifierOverflow')}</AlertDescription></Alert>
				) : null}
			</div>
		</Card>
	)
}
