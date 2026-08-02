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
import { useTranslations } from 'next-intl'

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
	const t = useTranslations('TournamentCreate')
	const { control, formState: { errors }, register } = useFormContext<TournamentFormData>()
	const validationMessage = errors.leagueUrl?.message ?? props.participantError ?? (props.leagueUrl ? props.leagueUrlState.message : null)
	const allSelected = props.participants.length > 0 && props.selectedParticipantIds.length === props.participants.length

	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">{t('participants')}</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label id="participant-source-label">{t('sourceType')} <span aria-hidden="true" className="text-destructive">*</span></Label>
					<Controller
						name="participantSource"
						control={control}
						render={({ field }) => (
							<RadioGroup value={field.value} onValueChange={field.onChange} aria-labelledby="participant-source-label" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
								{PARTICIPANT_SOURCES.map((source) => (
									<div key={source.value} className="flex items-center gap-2">
										<RadioGroupItem value={source.value} id={`source-${source.value}`} />
										<Label htmlFor={`source-${source.value}`}>{source.value === 'official' ? t('official') : t('custom')}</Label>
									</div>
								))}
							</RadioGroup>
						)}
					/>
					<p className="text-sm text-muted-foreground">{t('sourceHelp')}</p>
				</div>

				<div className="grid gap-3">
					<Label htmlFor="tournament-type">{t('tournamentType')}</Label>
					<Input id="tournament-type" value={t('standard')} readOnly aria-readonly="true" />
				</div>

				<div className="grid gap-3">
					<div className="flex items-center gap-2">
						<Label htmlFor="league-url">{t('leagueUrl')} <span aria-hidden="true" className="text-destructive">*</span></Label>
						<Tooltip>
							<TooltipTrigger asChild><button type="button" aria-label={t('aboutLeagueUrls')} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info aria-hidden="true" /></button></TooltipTrigger>
							<TooltipContent><p>{t('leagueUrlTooltip')}</p></TooltipContent>
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
							<p id="league-url-help" className="mt-1 text-xs text-muted-foreground">{t('leagueUrlHelp')}</p>
							{validationMessage ? <p id="league-url-error" role="alert" className="mt-1 text-sm text-destructive">{validationMessage}</p> : null}
						</div>
						<Button type="button" variant="outline" onClick={props.fetchParticipants} disabled={!props.leagueUrlState.valid || props.isLoading}>
							<LinkIcon data-icon="inline-start" aria-hidden="true" /> {props.isLoading ? t('loading') : t('fetchLeague')}
						</Button>
					</div>

					{!props.leagueUrlState.domainValid && props.leagueUrl ? (
						<Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertDescription>{t('domainInvalid')}</AlertDescription></Alert>
					) : null}
					{!props.participantsLoaded && props.leagueUrlState.valid ? (
						<Alert variant="info"><Info aria-hidden="true" /><AlertDescription>{t('urlValid')}</AlertDescription></Alert>
					) : null}
				</div>

				{props.participantsLoaded ? (
					<div>
						<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-muted-foreground">{t('participantSummary', { teams: props.participants.length, selected: props.selectedParticipantIds.length })}</p>
							<div className="flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center gap-1 text-sm text-success"><Check aria-hidden="true" /> {t('leagueLoaded')}</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button type="button" variant="outline" size="sm" onClick={props.applyAutoMode}><WandSparkles data-icon="inline-start" aria-hidden="true" /> {t('autoSetup')}</Button>
									</TooltipTrigger>
									<TooltipContent><p>{t('autoSetupHelp')}</p></TooltipContent>
								</Tooltip>
							</div>
						</div>

						<div className="overflow-hidden rounded-md border">
							<div className="overflow-x-auto">
								<Table>
									<TableHeader><TableRow><TableHead className="w-14"><span className="sr-only">{t('include')}</span></TableHead><TableHead>{t('team')}</TableHead><TableHead>{t('manager')}</TableHead></TableRow></TableHeader>
									<TableBody>
										{props.participants.map((participant) => (
											<TableRow key={participant.id}>
											<TableCell><input type="checkbox" checked={props.selectedParticipantIds.includes(participant.id)} disabled={props.participantSource === 'official'} aria-label={t('includeTeam', { team: participant.team })} onChange={(event) => props.toggleParticipant(participant.id, event.target.checked)} className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50" /></TableCell>
												<TableCell className="font-medium">{participant.team}</TableCell><TableCell>{participant.manager}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							<div className="flex items-center justify-between gap-4 border-t bg-accent/20 p-3">
								{props.participantSource === 'custom' ? <Button type="button" variant="outline" size="sm" onClick={props.toggleAllParticipants}>{allSelected ? t('deselectAll') : t('selectAll')}</Button> : <span className="text-sm text-muted-foreground">{t('allOfficialIncluded')}</span>}
								<span className="text-sm text-muted-foreground">{t('teamCount', { count: props.participants.length })}</span>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</Card>
	)
}
