'use client'

import PageShell from '@/components/layout/PageShell'
import { TournamentHelp } from '@/components/tournament/TournamentHelp'
import { useHydrated } from '@/hooks/use-hydrated'
import { Trophy } from 'lucide-react'
import { FormProvider } from 'react-hook-form'
import { TournamentCreateActions } from './_components/TournamentCreateActions'
import { ClassicLeagueImportCard } from './_components/ClassicLeagueImportCard'
import { TournamentGroupPhaseCard } from './_components/TournamentGroupPhaseCard'
import { TournamentInformationCard } from './_components/TournamentInformationCard'
import { TournamentKnockoutPhaseCard } from './_components/TournamentKnockoutPhaseCard'
import { TournamentParticipantsCard } from './_components/TournamentParticipantsCard'
import { TournamentCreationModeCard } from './_components/TournamentCreationModeCard'
import { useCreateTournament } from './_hooks/useCreateTournament'
import { useTranslations } from 'next-intl'

export default function CreateTournamentClient() {
	const t = useTranslations('TournamentCreate')
	const hydrated = useHydrated()
	const state = useCreateTournament()
	const canSubmit =
		state.participantsLoaded &&
		state.plan.groupReady &&
		state.plan.knockoutReady &&
		!state.isCheckingName &&
		state.isNameAvailable === true &&
		state.form.formState.isValid

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<header className="mb-8 flex items-start gap-3">
					<Trophy className="mt-1 size-8 shrink-0 text-primary-ink" aria-hidden="true" />
					<div>
						<h1 className="text-3xl font-bold">{t('title')}</h1>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">{t('subtitle')}</p>
					</div>
				</header>

				<FormProvider {...state.form}>
					<form
						onSubmit={state.form.handleSubmit(state.onSubmit)}
						noValidate
						inert={!hydrated || state.isSubmitting}
						aria-busy={!hydrated || state.isSubmitting}
					>
						<TournamentCreationModeCard
							mode={state.creationMode}
							onModeChange={state.changeCreationMode}
						/>

						{state.creationMode === 'classic' ? (
							<>
								<ClassicLeagueImportCard
									fetchParticipants={state.fetchParticipants}
									isLoading={state.isLoadingParticipants}
									leagueUrl={state.leagueUrl}
									leagueUrlState={state.leagueUrlState}
									loadedLeague={state.loadedLeague}
									participantCount={state.participants.length}
									participantError={state.participantError}
								/>
								{state.loadedLeague ? (
									<TournamentInformationCard
										isCheckingName={state.isCheckingName}
										isNameAvailable={state.isNameAvailable}
										nameCheckMessage={state.nameCheckMessage}
									/>
								) : null}
							</>
						) : (
							<>
								<div className="mb-8"><TournamentHelp /></div>
								<TournamentInformationCard isCheckingName={state.isCheckingName} isNameAvailable={state.isNameAvailable} nameCheckMessage={state.nameCheckMessage} />
								<TournamentParticipantsCard
									applyAutoMode={state.applyAutoMode}
									fetchParticipants={state.fetchParticipants}
									isLoading={state.isLoadingParticipants}
									leagueUrl={state.leagueUrl}
									leagueUrlState={state.leagueUrlState}
									participantError={state.participantError}
									participants={state.participants}
									participantsLoaded={state.participantsLoaded}
									participantSource={state.participantSource}
									selectedParticipantIds={state.selectedParticipantIds}
									toggleAllParticipants={state.toggleAllParticipants}
									toggleParticipant={state.toggleParticipant}
								/>
								{state.participantsLoaded ? (
									<TournamentGroupPhaseCard groupFormat={state.groupFormat} knockoutFormat={state.knockoutFormat} plan={state.plan} />
								) : null}
								{state.plan.groupReady ? <TournamentKnockoutPhaseCard knockoutFormat={state.knockoutFormat} plan={state.plan} /> : null}
							</>
						)}
						<TournamentCreateActions
							canSubmit={canSubmit}
							creationMode={state.creationMode}
							createdTournamentId={state.createdTournamentId}
							isSubmitting={state.isSubmitting}
							participantCount={state.plan.totalEntries}
							submitError={state.submitError}
							submitSuccess={state.submitSuccess}
						/>
					</form>
				</FormProvider>
			</div>
		</PageShell>
	)
}
