'use client'

import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr,
} from '@/components/data/DataTable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, Check, Info, Link as LinkIcon, WandSparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import {
	PARTICIPANT_SOURCES,
	type Participant,
	type TournamentFormData,
} from '../_lib/tournament-form'

/** FPL classic leagues can be 100+ teams — preview then expand. */
const PREVIEW_ROWS = 20
const ROW_STEP = 20

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
	const {
		control,
		formState: { errors },
		register,
	} = useFormContext<TournamentFormData>()
	const validationMessage =
		errors.leagueUrl?.message ??
		props.participantError ??
		(props.leagueUrl ? props.leagueUrlState.message : null)
	const allSelected =
		props.participants.length > 0 &&
		props.selectedParticipantIds.length === props.participants.length

	const [query, setQuery] = useState('')
	const [visibleCount, setVisibleCount] = useState(PREVIEW_ROWS)

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return props.participants
		return props.participants.filter(
			p =>
				p.team.toLowerCase().includes(q) ||
				p.manager.toLowerCase().includes(q) ||
				p.id.includes(q),
		)
	}, [props.participants, query])

	useEffect(() => {
		setVisibleCount(PREVIEW_ROWS)
	}, [props.participants, query])

	const total = filtered.length
	const displayRows = filtered.slice(0, visibleCount)
	const hasMore = total > visibleCount
	const remaining = Math.max(0, total - visibleCount)
	const canCollapse = visibleCount > PREVIEW_ROWS && total > PREVIEW_ROWS
	const nextStep = Math.min(ROW_STEP, remaining)

	return (
		<Card className="mb-8 p-6">
			<h2 className="mb-6 text-xl font-semibold">{t('participants')}</h2>
			<div className="flex flex-col gap-6">
				<div className="grid gap-3">
					<Label id="participant-source-label">
						{t('sourceType')}{' '}
						<span aria-hidden="true" className="text-destructive">
							*
						</span>
					</Label>
					<Controller
						name="participantSource"
						control={control}
						render={({ field }) => (
							<RadioGroup
								value={field.value}
								onValueChange={field.onChange}
								aria-labelledby="participant-source-label"
								className="flex flex-col gap-2 sm:flex-row sm:gap-6"
							>
								{PARTICIPANT_SOURCES.map(source => (
									<div key={source.value} className="flex items-center gap-2">
										<RadioGroupItem
											value={source.value}
											id={`source-${source.value}`}
										/>
										<Label htmlFor={`source-${source.value}`}>
											{source.value === 'official' ? t('official') : t('custom')}
										</Label>
									</div>
								))}
							</RadioGroup>
						)}
					/>
					<p className="text-sm text-muted-foreground">{t('sourceHelp')}</p>
				</div>

				<div className="grid gap-3">
					<Label htmlFor="tournament-type">{t('tournamentType')}</Label>
					<Input
						id="tournament-type"
						value={t('standard')}
						readOnly
						aria-readonly="true"
					/>
				</div>

				<div className="grid gap-3">
					<div className="flex items-center gap-2">
						<Label htmlFor="league-url">
							{t('leagueUrl')}{' '}
							<span aria-hidden="true" className="text-destructive">
								*
							</span>
						</Label>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label={t('aboutLeagueUrls')}
									className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<Info aria-hidden="true" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>{t('leagueUrlTooltip')}</p>
							</TooltipContent>
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
							<p
								id="league-url-help"
								className="mt-1 text-xs text-muted-foreground"
							>
								{t('leagueUrlHelp')}
							</p>
							{validationMessage ? (
								<p
									id="league-url-error"
									role="alert"
									className="mt-1 text-sm text-destructive"
								>
									{validationMessage}
								</p>
							) : null}
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={props.fetchParticipants}
							disabled={!props.leagueUrlState.valid || props.isLoading}
						>
							<LinkIcon data-icon="inline-start" aria-hidden="true" />{' '}
							{props.isLoading ? t('loading') : t('fetchLeague')}
						</Button>
					</div>

					{!props.leagueUrlState.domainValid && props.leagueUrl ? (
						<Alert variant="destructive">
							<AlertTriangle aria-hidden="true" />
							<AlertDescription>{t('domainInvalid')}</AlertDescription>
						</Alert>
					) : null}
					{!props.participantsLoaded && props.leagueUrlState.valid ? (
						<Alert variant="info">
							<Info aria-hidden="true" />
							<AlertDescription>{t('urlValid')}</AlertDescription>
						</Alert>
					) : null}
				</div>

				{props.participantsLoaded ? (
					<div>
						<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-muted-foreground">
								{t('participantSummary', {
									teams: props.participants.length,
									selected: props.selectedParticipantIds.length,
								})}
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center gap-1 text-sm text-success">
									<Check aria-hidden="true" /> {t('leagueLoaded')}
								</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={props.applyAutoMode}
										>
											<WandSparkles data-icon="inline-start" aria-hidden="true" />{' '}
											{t('autoSetup')}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>{t('autoSetupHelp')}</p>
									</TooltipContent>
								</Tooltip>
							</div>
						</div>

						{props.participants.length > PREVIEW_ROWS ? (
							<div className="mb-3">
								<Input
									type="search"
									value={query}
									onChange={e => setQuery(e.target.value)}
									placeholder={t('searchParticipants')}
									aria-label={t('searchParticipants')}
									className="h-9 sm:max-w-xs"
								/>
							</div>
						) : null}

						<div className="overflow-hidden rounded-md border">
							<DataTable className="mx-0 px-0">
								<DataThead>
											<DataTh className="w-14">
												<span className="sr-only">{t('include')}</span>
											</DataTh>
											<DataTh>{t('team')}</DataTh>
											<DataTh>{t('manager')}</DataTh>
								</DataThead>
									<tbody>
										{displayRows.length === 0 ? (
											<DataTr>
												<DataTd
													colSpan={3}
													className="py-8 text-center text-sm text-muted-foreground"
												>
													{t('noMatchingParticipants')}
												</DataTd>
											</DataTr>
										) : (
											displayRows.map(participant => (
												<DataTr key={participant.id}>
													<DataTd>
														<input
															type="checkbox"
															checked={props.selectedParticipantIds.includes(
																participant.id,
															)}
															disabled={props.participantSource === 'official'}
															aria-label={t('includeTeam', {
																team: participant.team,
															})}
															onChange={event =>
																props.toggleParticipant(
																	participant.id,
																	event.target.checked,
																)
															}
															className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
														/>
													</DataTd>
													<DataTd className="font-medium">
														{participant.team}
													</DataTd>
													<DataTd>{participant.manager}</DataTd>
												</DataTr>
											))
										)}
									</tbody>
							</DataTable>
							<div className="flex flex-col gap-3 border-t bg-accent/20 p-3 sm:flex-row sm:items-center sm:justify-between">
								{props.participantSource === 'custom' ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={props.toggleAllParticipants}
									>
										{allSelected ? t('deselectAll') : t('selectAll')}
									</Button>
								) : (
									<span className="text-sm text-muted-foreground">
										{t('allOfficialIncluded')}
									</span>
								)}
								<span className="text-sm text-muted-foreground">
									{total !== props.participants.length
										? t('participantFilteredCount', {
												shown: Math.min(visibleCount, total),
												matched: total,
												total: props.participants.length,
											})
										: t('teamCount', { count: props.participants.length })}
								</span>
							</div>
							{hasMore || canCollapse ? (
								<div className="flex flex-wrap items-center justify-center gap-2 border-t px-3 py-3">
									{hasMore ? (
										<>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="text-xs"
												onClick={() =>
													setVisibleCount(c => Math.min(c + ROW_STEP, total))
												}
											>
												{t('showMoreParticipants', { count: nextStep })}
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="text-xs"
												onClick={() => setVisibleCount(total)}
											>
												{t('showAllParticipants', { count: total })}
											</Button>
										</>
									) : null}
									{canCollapse ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-xs"
											onClick={() => setVisibleCount(PREVIEW_ROWS)}
										>
											{t('showLessParticipants')}
										</Button>
									) : null}
								</div>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		</Card>
	)
}
