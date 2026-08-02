import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import type { TournamentFormData } from '../_lib/tournament-form'

interface TournamentInformationCardProps {
	isCheckingName: boolean
	isNameAvailable: boolean | null
	nameCheckMessage: string | null
}

export function TournamentInformationCard({ isCheckingName, isNameAvailable, nameCheckMessage }: TournamentInformationCardProps) {
	const { formState: { errors }, register } = useFormContext<TournamentFormData>()
	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">Tournament Information</h2>
			<div className="grid gap-3">
				<div className="flex items-center gap-2">
					<Label htmlFor="tournament-name">Tournament Name <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Tooltip>
						<TooltipTrigger asChild>
							<button type="button" aria-label="About tournament names" className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<Info aria-hidden="true" />
							</button>
						</TooltipTrigger>
						<TooltipContent><p>Choose a unique name between 3 and 80 characters.</p></TooltipContent>
					</Tooltip>
				</div>
				<Input id="tournament-name" {...register('tournamentName')} placeholder="Enter tournament name" aria-invalid={Boolean(errors.tournamentName) || isNameAvailable === false} aria-describedby="tournament-name-status" />
				<p
					id="tournament-name-status"
					aria-live="polite"
					className={`min-h-5 text-sm ${errors.tournamentName || isNameAvailable === false ? 'text-destructive' : isNameAvailable ? 'text-success' : 'text-muted-foreground'}`}
				>
					{errors.tournamentName?.message ?? (isCheckingName ? 'Checking tournament name…' : nameCheckMessage)}
				</p>
			</div>
		</Card>
	)
}
