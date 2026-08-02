'use client'

import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { useRouter } from '@/i18n/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TournamentNameForm } from '../_lib/tournament-management'

type MutationState =
	| { kind: 'idle'; message: null }
	| { kind: 'success' | 'error'; message: string }

export function useTournamentManagement(tournament: EntryTournament) {
	const t = useTranslations('TournamentManage')
	const router = useRouter()
	const [currentName, setCurrentName] = useState(tournament.name)
	const [isSaving, setIsSaving] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [mutationState, setMutationState] = useState<MutationState>({
		kind: 'idle',
		message: null,
	})

	const renameTournament = async ({ name }: TournamentNameForm) => {
		const normalizedName = name.trim()
		if (normalizedName === currentName) {
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

			setCurrentName(normalizedName)
			setMutationState({ kind: 'success', message: t('nameUpdated') })
			router.refresh()
			return true
		} catch {
			setMutationState({
				kind: 'error',
				message: t('nameUpdateFailed'),
			})
			return false
		} finally {
			setIsSaving(false)
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

			router.replace('/tournament/list')
			router.refresh()
			return true
		} catch {
			setMutationState({
				kind: 'error',
				message: t('deleteFailed'),
			})
			return false
		} finally {
			setIsDeleting(false)
		}
	}

	return {
		currentName,
		deleteTournament,
		isDeleting,
		isSaving,
		mutationState,
		renameTournament,
	}
}
