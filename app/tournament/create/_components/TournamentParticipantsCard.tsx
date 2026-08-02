import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, Check, Info, Link as LinkIcon, WandSparkles } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { PARTICIPANT_SOURCES, type Participant, type TournamentFormData } from '../_lib/tournament-form'

interface TournamentParticipantsCardProps {
	applyAutoMode: () => void
	fetchParticipants: () => void
	isLoading: boolean
	leagueUrl: string
	leagueUrlState: { valid: boolean; domainValid: boolean; message: string | null }
	participantError: string | null
	participants: Participant[]
	participantsLoaded: boolean
	participantSource: 'official' | 'custom'
	selectedParticipantIds: string[]
	toggleAllParticipants: () => void
	toggleParticipant: (participantId: string, selected: boolean) => void
}

export function TournamentParticipantsCard(props: TournamentParticipantsCardProps) {
	const { control, formState: { errors }, register } = useFormContext<TournamentFormData>()
	const validationMessage = errors.leagueUrl?.message ?? props.participantError ?? (props.leagueUrl ? props.leagueUrlState.message : null)
	const allSelected = props.participants.length > 0 && props.selectedParticipantIds.length === props.participants.length

	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">Participants</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label id="participant-source-label">Source Type <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller
						name="participantSource"
						control={control}
						render={({ field }) => (
							<RadioGroup value={field.value} onValueChange={field.onChange} aria-labelledby="participant-source-label" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
								{PARTICIPANT_SOURCES.map((source) => (
									<div key={source.value} className="flex items-center gap-2">
										<RadioGroupItem value={source.value} id={`source-${source.value}`} />
										<Label htmlFor={`source-${source.value}`}>{source.label}</Label>
									</div>
								))}
							</RadioGroup>
						)}
					/>
					<p className="text-sm text-muted-foreground">Official includes every league entry. Custom lets you choose a subset after the league is loaded.</p>
				</div>

				<div className="grid gap-3">
					<Label htmlFor="tournament-type">Tournament Type</Label>
					<Input id="tournament-type" value="Standard" readOnly aria-readonly="true" />
				</div>

				<div className="grid gap-3">
					<div className="flex items-center gap-2">
						<Label htmlFor="league-url">Official League URL <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Tooltip>
							<TooltipTrigger asChild><button type="button" aria-label="About official league URLs" className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info aria-hidden="true" /></button></TooltipTrigger>
							<TooltipContent><p>Paste the full FPL standings, admin, or join URL.</p></TooltipContent>
						</Tooltip>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start">
						<div className="flex-1">
							<Input
								id="league-url"
								{...register('leagueUrl')}
								placeholder="https://fantasy.premierleague.com/leagues/12345/standings"
								aria-invalid={Boolean(validationMessage)}
								aria-describedby="league-url-help league-url-error"
							/>
							<p id="league-url-help" className="mt-1 text-xs text-muted-foreground">Only fantasy.premierleague.com league URLs are accepted.</p>
							{validationMessage ? <p id="league-url-error" role="alert" className="mt-1 text-sm text-destructive">{validationMessage}</p> : null}
						</div>
						<Button type="button" variant="outline" onClick={props.fetchParticipants} disabled={!props.leagueUrlState.valid || props.isLoading}>
							<LinkIcon data-icon="inline-start" aria-hidden="true" /> {props.isLoading ? 'Loading…' : 'Fetch league'}
						</Button>
					</div>

					{!props.leagueUrlState.domainValid && props.leagueUrl ? (
						<Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertDescription>Only secure URLs from fantasy.premierleague.com are allowed.</AlertDescription></Alert>
					) : null}
					{!props.participantsLoaded && props.leagueUrlState.valid ? (
						<Alert variant="info"><Info aria-hidden="true" /><AlertDescription>The URL is valid. Fetch the league to confirm and choose its participants.</AlertDescription></Alert>
					) : null}
				</div>

				{props.participantsLoaded ? (
					<div>
						<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-muted-foreground">{props.participants.length} teams · {props.selectedParticipantIds.length} selected</p>
							<div className="flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center gap-1 text-sm text-success"><Check aria-hidden="true" /> League loaded</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button type="button" variant="outline" size="sm" onClick={props.applyAutoMode}><WandSparkles data-icon="inline-start" aria-hidden="true" /> Auto setup</Button>
									</TooltipTrigger>
									<TooltipContent><p>Use all teams in a GW1–38 points race with no knockout.</p></TooltipContent>
								</Tooltip>
							</div>
						</div>

						<div className="overflow-hidden rounded-md border">
							<div className="overflow-x-auto">
								<Table>
									<TableHeader><TableRow><TableHead className="w-14"><span className="sr-only">Include</span></TableHead><TableHead>Team</TableHead><TableHead>Manager</TableHead></TableRow></TableHeader>
									<TableBody>
										{props.participants.map((participant) => (
											<TableRow key={participant.id}>
												<TableCell><input type="checkbox" checked={props.selectedParticipantIds.includes(participant.id)} disabled={props.participantSource === 'official'} aria-label={`Include ${participant.team}`} onChange={(event) => props.toggleParticipant(participant.id, event.target.checked)} className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50" /></TableCell>
												<TableCell className="font-medium">{participant.team}</TableCell><TableCell>{participant.manager}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							<div className="flex items-center justify-between gap-4 border-t bg-accent/20 p-3">
								{props.participantSource === 'custom' ? <Button type="button" variant="outline" size="sm" onClick={props.toggleAllParticipants}>{allSelected ? 'Deselect all' : 'Select all'}</Button> : <span className="text-sm text-muted-foreground">All official entries are included</span>}
								<span className="text-sm text-muted-foreground">{props.participants.length} teams</span>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</Card>
	)
}
