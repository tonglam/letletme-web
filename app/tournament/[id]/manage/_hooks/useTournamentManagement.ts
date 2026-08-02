'use client'

import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { TournamentNameForm } from '../_lib/tournament-management'
import { readTournamentMutationError } from '../_lib/tournament-management'

type MutationState =
	| { kind: 'idle'; message: null }
	| { kind: 'success' | 'error'; message: string }

export function useTournamentManagement(tournament: EntryTournament) {
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
			setMutationState({ kind: 'success', message: 'The tournament name is already up to date.' })
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
			if (!response.ok) throw new Error(await readTournamentMutationError(response))

			setCurrentName(normalizedName)
			setMutationState({ kind: 'success', message: 'Tournament name updated.' })
			router.refresh()
			return true
		} catch (error) {
			setMutationState({
				kind: 'error',
				message: error instanceof Error ? error.message : 'Tournament name could not be updated.',
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
			if (!response.ok) throw new Error(await readTournamentMutationError(response))

			router.replace('/tournament/list')
			router.refresh()
			return true
		} catch (error) {
			setMutationState({
				kind: 'error',
				message: error instanceof Error ? error.message : 'Tournament could not be deleted.',
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
