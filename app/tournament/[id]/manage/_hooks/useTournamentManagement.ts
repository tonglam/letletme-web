'use client'

import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import {
	isTournamentRosterSyncInFlight,
	isTournamentSetupInFlight,
} from '@/lib/tournament/lifecycle'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { TournamentNameForm } from '../_lib/tournament-management'

export type TournamentManagementAction =
	| 'retry_setup'
	| 'retry_roster'
	| 'pause'
	| 'resume'
	| 'enable_official_sync'

type MutationState =
	| { kind: 'idle'; message: null }
	| { kind: 'success' | 'error'; message: string }

/** Logical server snapshot — ignores object identity from router.refresh(). */
function serverRevision(t: EntryTournament): string {
	return [
		t.id,
		t.updatedAt,
		t.name,
		t.state,
		t.setupStatus,
		t.setupPhase,
		t.setupCompletedUnits,
		t.setupTotalUnits,
		t.standingsReadyAt,
		t.rosterSyncStatus,
		t.rosterLastSyncedAt,
		t.setupHasWarnings,
	].join('|')
}

export function useTournamentManagement(tournament: EntryTournament) {
	const t = useTranslations('TournamentManage')
	const router = useRouter()
	const [tournamentState, setTournamentState] = useState(() => ({
		serverTournament: tournament,
		currentTournament: tournament,
	}))
	// Sync server props outside render (setup poll calls router.refresh often).
	// Only replace local state when the logical server revision changes — not on
	// every new object reference — so optimistic renames survive polling.
	useEffect(() => {
		setTournamentState(current => {
			if (current.serverTournament === tournament) return current
			const prevRev = serverRevision(current.serverTournament)
			const nextRev = serverRevision(tournament)
			if (prevRev === nextRev) {
				return { ...current, serverTournament: tournament }
			}
			return {
				serverTournament: tournament,
				currentTournament: tournament,
			}
		})
	}, [tournament])
	const currentTournament =
		serverRevision(tournamentState.serverTournament) === serverRevision(tournament)
			? tournamentState.currentTournament
			: tournament
	const updateCurrentTournament = (
		update: (current: EntryTournament) => EntryTournament,
	) => {
		setTournamentState(current => {
			const base =
				serverRevision(current.serverTournament) === serverRevision(tournament)
					? current.currentTournament
					: tournament
			return {
				serverTournament: tournament,
				currentTournament: update(base),
			}
		})
	}
	const [isSaving, setIsSaving] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [pendingAction, setPendingAction] =
		useState<TournamentManagementAction | null>(null)
	const [mutationState, setMutationState] = useState<MutationState>({
		kind: 'idle',
		message: null,
	})
	const rosterSyncInFlight = isTournamentRosterSyncInFlight(
		currentTournament.rosterSyncStatus,
	)
	const setupInFlight = isTournamentSetupInFlight(currentTournament.setupStatus)
	const lifecycleWorkInFlight = rosterSyncInFlight || setupInFlight

	useEffect(() => {
		if (!lifecycleWorkInFlight) return
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible' && navigator.onLine) {
				router.refresh()
			}
		}, 5_000)
		return () => window.clearInterval(timer)
	}, [lifecycleWorkInFlight, router])

	const renameTournament = async ({ name }: TournamentNameForm) => {
		const normalizedName = name.trim()
		if (normalizedName === currentTournament.name) {
			setMutationState({ kind: 'success', message: t('nameCurrent') })
			return true
		}

		setIsSaving(true)
		setMutationState({ kind: 'idle', message: null })
		try {
			const response = await fetch(`/api/tournaments/${tournament.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: normalizedName }),
			})
			if (!response.ok) throw new Error(t('nameUpdateFailed'))

			updateCurrentTournament(current => ({
				...current,
				name: normalizedName,
			}))
			setMutationState({ kind: 'success', message: t('nameUpdated') })
			router.refresh()
			return true
		} catch {
			setMutationState({ kind: 'error', message: t('nameUpdateFailed') })
			return false
		} finally {
			setIsSaving(false)
		}
	}

	const runAction = async (action: TournamentManagementAction) => {
		if (
			pendingAction ||
			(action === 'retry_roster' && rosterSyncInFlight) ||
			(action === 'resume' && setupInFlight)
		) {
			return false
		}
		setPendingAction(action)
		setMutationState({ kind: 'idle', message: null })
		try {
			const response = await fetch(`/api/tournaments/${tournament.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action }),
			})
			if (!response.ok) throw new Error('action failed')

			updateCurrentTournament(current => {
				if (action === 'pause') return { ...current, state: 'INACTIVE' }
				if (action === 'resume') {
					return { ...current, setupStatus: 'PENDING', setupPhase: 'QUEUED' }
				}
				if (action === 'retry_setup') {
					return {
						...current,
						setupStatus: 'PENDING',
						setupPhase: 'QUEUED',
						setupHasWarnings: false,
					}
				}
				if (action === 'retry_roster') {
					return { ...current, rosterSyncStatus: 'PROCESSING' }
				}
				return {
					...current,
					rosterMode: 'OFFICIAL_SYNC',
					rosterSyncStatus: 'PROCESSING',
				}
			})
			setMutationState({
				kind: 'success',
				message: t(`actionSuccess.${action}`),
			})
			router.refresh()
			return true
		} catch {
			setMutationState({ kind: 'error', message: t(`actionFailed.${action}`) })
			return false
		} finally {
			setPendingAction(null)
		}
	}

	const deleteTournament = async () => {
		setIsDeleting(true)
		setMutationState({ kind: 'idle', message: null })
		try {
			const response = await fetch(`/api/tournaments/${tournament.id}`, {
				method: 'DELETE',
			})
			if (!response.ok) throw new Error(t('deleteFailed'))

			router.replace('/tournament/browse')
			router.refresh()
			return true
		} catch {
			setMutationState({ kind: 'error', message: t('deleteFailed') })
			return false
		} finally {
			setIsDeleting(false)
		}
	}

	return {
		currentName: currentTournament.name,
		currentTournament,
		deleteTournament,
		isDeleting,
		isSaving,
		mutationState,
		pendingAction,
		renameTournament,
		runAction,
	}
}
