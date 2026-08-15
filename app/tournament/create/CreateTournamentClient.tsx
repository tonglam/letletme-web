'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { TournamentHelp } from '@/components/tournament/TournamentHelp'
import { useHydrated } from '@/hooks/use-hydrated'
import { FormProvider } from 'react-hook-form'
import { TournamentCreateActions } from './_components/TournamentCreateActions'
import { ClassicLeagueImportCard } from './_components/ClassicLeagueImportCard'
import { TournamentInformationCard } from './_components/TournamentInformationCard'
import { TournamentCreationModeCard } from './_components/TournamentCreationModeCard'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { useCreateTournament } from './_hooks/useCreateTournament'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

const TournamentParticipantsCard = dynamic(() =>
	import('./_components/TournamentParticipantsCard').then(
		mod => mod.TournamentParticipantsCard
	)
)
const TournamentGroupPhaseCard = dynamic(() =>
	import('./_components/TournamentGroupPhaseCard').then(
		mod => mod.TournamentGroupPhaseCard
	)
)
const TournamentKnockoutPhaseCard = dynamic(() =>
	import('./_components/TournamentKnockoutPhaseCard').then(
		mod => mod.TournamentKnockoutPhaseCard
	)
)

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
			<RouteReadyMarker
				name="COMPETITIONS_CREATE_READY"
				audienceHint="session-hint"
				goodMs={1000}
				poorMs={1500}
			/>
			<div
				className="container mx-auto max-w-4xl px-4 py-8"
				data-competition-perf-ready="create"
			>
				<StatsPageHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					badge={<TournamentHelp className="shrink-0" />}
				/>
				<p className="-mt-4 mb-8 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('subtitle')}
				</p>

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

						{state.creationMode !== 'custom' ? (
							<>
								<ClassicLeagueImportCard
									mode={state.creationMode}
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
								<TournamentInformationCard
									isCheckingName={state.isCheckingName}
									isNameAvailable={state.isNameAvailable}
									nameCheckMessage={state.nameCheckMessage}
								/>
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
									<TournamentGroupPhaseCard
										groupFormat={state.groupFormat}
										knockoutFormat={state.knockoutFormat}
										plan={state.plan}
									/>
								) : null}
								{state.plan.groupReady ? (
									<TournamentKnockoutPhaseCard
										knockoutFormat={state.knockoutFormat}
										plan={state.plan}
									/>
								) : null}
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
