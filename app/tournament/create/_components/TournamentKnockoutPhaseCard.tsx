import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { KNOCKOUT_FORMATS, type TournamentFormData, type TournamentPlan } from '../_lib/tournament-form'
import { TournamentPlanMetric } from './TournamentPlanMetric'

export function TournamentKnockoutPhaseCard({ knockoutFormat, plan }: { knockoutFormat: 'none' | 'single' | 'double'; plan: TournamentPlan }) {
	const { control } = useFormContext<TournamentFormData>()
	const display = (value: string | number) => knockoutFormat === 'none' ? '—' : value
	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">Knockout Phase</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label htmlFor="knockout-format">Knockout Mode <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller name="knockoutFormat" control={control} render={({ field }) => (
						<Select value={field.value} onValueChange={field.onChange}><SelectTrigger id="knockout-format"><SelectValue placeholder="Select format" /></SelectTrigger><SelectContent><SelectGroup>{KNOCKOUT_FORMATS.map((format) => <SelectItem key={format.value} value={format.value}>{format.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
					)} />
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					<TournamentPlanMetric label="Knockout Teams" value={display(plan.knockoutTeamCount)} />
					<TournamentPlanMetric label="Start Gameweek" value={display(plan.knockoutStart > 0 ? `GW${plan.knockoutStart}` : '—')} />
					<TournamentPlanMetric label="End Gameweek" value={display(plan.knockoutEnd > 0 ? `GW${plan.knockoutEnd}` : '—')} />
					<TournamentPlanMetric label="Rounds" value={display(plan.knockoutRounds)} />
					<TournamentPlanMetric label="Elimination Stages" value={display(plan.knockoutEventCount)} />
					<TournamentPlanMetric label="Meetings Per Tie" value={display(plan.knockoutPlayAgainstCount)} />
				</div>

				{knockoutFormat !== 'none' && plan.knockoutTeamCount < 2 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>A knockout phase needs at least two qualifying teams.</AlertDescription></Alert> : null}
				{knockoutFormat !== 'none' && !plan.knockoutTeamCountIsPowerOfTwo ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>Knockout teams must total a power of two (2, 4, 8, 16, or 32).</AlertDescription></Alert> : null}
				{knockoutFormat !== 'none' && plan.knockoutEnd > 38 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>The knockout phase exceeds GW38. Reduce the qualifiers or remove the knockout phase.</AlertDescription></Alert> : null}
			</div>
		</Card>
	)
}
