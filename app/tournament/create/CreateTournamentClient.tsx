'use client'

import PageShell from '@/components/layout/PageShell'
import { TournamentHelp } from '@/components/tournament/TournamentHelp'
import { useHydrated } from '@/hooks/use-hydrated'
import { Trophy } from 'lucide-react'
import { FormProvider } from 'react-hook-form'
import { TournamentCreateActions } from './_components/TournamentCreateActions'
import { TournamentGroupPhaseCard } from './_components/TournamentGroupPhaseCard'
import { TournamentInformationCard } from './_components/TournamentInformationCard'
import { TournamentKnockoutPhaseCard } from './_components/TournamentKnockoutPhaseCard'
import { TournamentParticipantsCard } from './_components/TournamentParticipantsCard'
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
				<header className="mb-8 flex items-center gap-3">
					<Trophy className="size-8 text-primary" aria-hidden="true" />
					<h1 className="text-3xl font-bold">{t('title')}</h1>
				</header>
				<div className="mb-8"><TournamentHelp /></div>

				<FormProvider {...state.form}>
					<form
						onSubmit={state.form.handleSubmit(state.onSubmit)}
						noValidate
						inert={!hydrated || state.isSubmitting}
						aria-busy={!hydrated || state.isSubmitting}
					>
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
						<TournamentCreateActions
							canSubmit={canSubmit}
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
