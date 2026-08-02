import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { GAMEWEEKS, GROUP_FORMATS, type TournamentFormData, type TournamentPlan } from '../_lib/tournament-form'
import { TournamentPlanMetric } from './TournamentPlanMetric'

interface TournamentGroupPhaseCardProps {
	groupFormat: 'none' | 'points'
	knockoutFormat: 'none' | 'single' | 'double'
	plan: TournamentPlan
}

export function TournamentGroupPhaseCard({ groupFormat, knockoutFormat, plan }: TournamentGroupPhaseCardProps) {
	const { control, formState: { errors }, register } = useFormContext<TournamentFormData>()
	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">Group Phase</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label htmlFor="group-format">Group Mode <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller name="groupFormat" control={control} render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}>
							<SelectTrigger id="group-format"><SelectValue placeholder="Select format" /></SelectTrigger>
							<SelectContent><SelectGroup>{GROUP_FORMATS.map((format) => <SelectItem key={format.value} value={format.value}>{format.label}</SelectItem>)}</SelectGroup></SelectContent>
						</Select>
					)} />
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="grid gap-3">
						<Label htmlFor="start-gameweek">Start Gameweek <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Controller name="startGameweek" control={control} render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="start-gameweek" aria-invalid={Boolean(errors.startGameweek)}><SelectValue placeholder="Select gameweek" /></SelectTrigger><SelectContent><SelectGroup>{GAMEWEEKS.map((gameweek) => <SelectItem key={gameweek.value} value={gameweek.value}>{gameweek.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
						)} />
					</div>
					<div className="grid gap-3">
						<Label htmlFor="end-gameweek">End Gameweek <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Controller name="endGameweek" control={control} render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="end-gameweek" aria-invalid={Boolean(errors.endGameweek)} aria-describedby="end-gameweek-error"><SelectValue placeholder="Select gameweek" /></SelectTrigger><SelectContent><SelectGroup>{GAMEWEEKS.map((gameweek) => <SelectItem key={gameweek.value} value={gameweek.value}>{gameweek.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
						)} />
						{errors.endGameweek ? <p id="end-gameweek-error" className="text-sm text-destructive">{errors.endGameweek.message}</p> : null}
					</div>
				</div>

				{groupFormat === 'points' ? (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="grid gap-3"><Label htmlFor="group-num">Group Number <span aria-hidden="true" className="text-destructive">*</span></Label><Input id="group-num" type="number" min="1" inputMode="numeric" {...register('groupNum')} aria-invalid={Boolean(errors.groupNum)} aria-describedby="group-num-error" />{errors.groupNum ? <p id="group-num-error" className="text-sm text-destructive">{errors.groupNum.message}</p> : null}</div>
						{knockoutFormat !== 'none' ? <div className="grid gap-3"><Label htmlFor="qualifiers-per-group">Qualifiers Per Group <span aria-hidden="true" className="text-destructive">*</span></Label><Input id="qualifiers-per-group" type="number" min="1" inputMode="numeric" {...register('qualifiersPerGroup')} aria-invalid={Boolean(errors.qualifiersPerGroup)} aria-describedby="qualifiers-per-group-error" />{errors.qualifiersPerGroup ? <p id="qualifiers-per-group-error" className="text-sm text-destructive">{errors.qualifiersPerGroup.message}</p> : null}</div> : null}
					</div>
				) : null}

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<TournamentPlanMetric label="Total Entries" value={plan.totalEntries} />
					<TournamentPlanMetric label="Group Rounds" value={plan.groupRounds} />
					<TournamentPlanMetric label="Teams Per Group" value={plan.groupTeamCount} />
					<TournamentPlanMetric label="Groups" value={groupFormat === 'points' ? plan.groupCount : 1} />
				</div>

				{plan.qualifyTotalExceedsEntries ? (
					<Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>The total number of qualifiers cannot exceed the selected entries.</AlertDescription></Alert>
				) : null}
			</div>
		</Card>
	)
}
