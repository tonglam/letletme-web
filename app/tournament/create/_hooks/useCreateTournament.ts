'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
	computeTournamentPlan,
	createTournamentFormSchema,
	DEFAULT_TOURNAMENT_FORM,
	validateLeagueUrl,
	type Participant,
	type ParticipantApiItem,
	type TournamentFormData,
} from '../_lib/tournament-form'
import { useTranslations } from 'next-intl'

async function readJson(response: Response): Promise<Record<string, unknown>> {
	try {
		const payload: unknown = await response.json()
		return payload && typeof payload === 'object' && !Array.isArray(payload)
			? payload as Record<string, unknown>
			: {}
	} catch {
		return {}
	}
}

export function useCreateTournament() {
	const t = useTranslations('TournamentCreate')
	const schema = useMemo(() => createTournamentFormSchema({
		nameTooShort: t('errors.nameTooShort'),
		nameTooLong: t('errors.nameTooLong'),
		validGameweek: t('errors.validGameweek'),
		validLeagueUrl: t('errors.validLeagueUrl'),
		gameweekOrder: t('errors.gameweekOrder'),
		groupPositive: t('errors.groupPositive'),
		groupInvalid: t('errors.groupInvalid'),
		qualifierPositive: t('errors.qualifierPositive'),
		qualifierInvalid: t('errors.qualifierInvalid'),
	}), [t])
	const form = useForm<TournamentFormData>({
		resolver: zodResolver(schema),
		defaultValues: DEFAULT_TOURNAMENT_FORM,
		mode: 'onChange',
	})
	const { control, setValue } = form
	const participantSource = useWatch({ control, name: 'participantSource' })
	const leagueUrl = useWatch({ control, name: 'leagueUrl' })
	const tournamentName = useWatch({ control, name: 'tournamentName' })
	const groupFormat = useWatch({ control, name: 'groupFormat' })
	const startGameweek = useWatch({ control, name: 'startGameweek' })
	const endGameweek = useWatch({ control, name: 'endGameweek' })
	const groupNum = useWatch({ control, name: 'groupNum' })
	const qualifiersPerGroup = useWatch({ control, name: 'qualifiersPerGroup' })
	const knockoutFormat = useWatch({ control, name: 'knockoutFormat' })
	const normalizedTournamentName = tournamentName?.trim() ?? ''

	const [participants, setParticipants] = useState<Participant[]>([])
	const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
	const [participantsLoaded, setParticipantsLoaded] = useState(false)
	const [fetchedLeagueUrl, setFetchedLeagueUrl] = useState<string | null>(null)
	const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isCheckingName, setIsCheckingName] = useState(false)
	const [isNameAvailable, setIsNameAvailable] = useState<boolean | null>(null)
	const [nameCheckMessage, setNameCheckMessage] = useState<string | null>(null)
	const [checkedTournamentName, setCheckedTournamentName] = useState('')
	const [participantError, setParticipantError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
	const [createdTournamentId, setCreatedTournamentId] = useState<number | null>(null)
	const [createdTournamentName, setCreatedTournamentName] = useState('')

	const leagueUrlState = useMemo(() => validateLeagueUrl(leagueUrl ?? '', {
		domainInvalid: t('domainInvalid'),
		pathInvalid: t('leagueUrlPathInvalid'),
		incomplete: t('leagueUrlIncomplete'),
	}), [leagueUrl, t])
	const participantsAreCurrent = participantsLoaded && fetchedLeagueUrl === leagueUrl
	const effectiveSelectedParticipantIds = participantSource === 'official' && participantsAreCurrent
		? participants.map((participant) => participant.id)
		: selectedParticipantIds
	const totalEntries = participantsAreCurrent
		? participantSource === 'official' ? participants.length : selectedParticipantIds.length
		: 0
	const plan = useMemo(
		() => computeTournamentPlan(
			{ groupFormat, startGameweek, endGameweek, groupNum, qualifiersPerGroup, knockoutFormat },
			totalEntries,
			participantsAreCurrent,
		),
		[endGameweek, groupFormat, groupNum, knockoutFormat, participantsAreCurrent, qualifiersPerGroup, startGameweek, totalEntries],
	)
	const activeNameCheck = checkedTournamentName === normalizedTournamentName
	const hasValidNameLength = normalizedTournamentName.length >= 3 && normalizedTournamentName.length <= 80
	const currentIsCheckingName = hasValidNameLength && (!activeNameCheck || isCheckingName)
	const currentIsNameAvailable = !hasValidNameLength || !activeNameCheck
		? null
		: isNameAvailable
	const currentNameCheckMessage = normalizedTournamentName.length === 0
		? null
		: normalizedTournamentName.length < 3
			? t('errors.nameTooShort')
			: normalizedTournamentName.length > 80
				? t('errors.nameTooLong')
			: activeNameCheck
				? nameCheckMessage
				: t('checkingName')
	const currentSubmitSuccess = createdTournamentName === normalizedTournamentName ? submitSuccess : null
	const currentCreatedTournamentId = createdTournamentName === normalizedTournamentName ? createdTournamentId : null

	useEffect(() => {
		if (!hasValidNameLength) return

		let cancelled = false
		const controller = new AbortController()
		const timeoutId = window.setTimeout(async () => {
			setCheckedTournamentName(normalizedTournamentName)
			setIsCheckingName(true)
			setIsNameAvailable(null)
			setNameCheckMessage(t('checkingName'))
			try {
				const response = await fetch(`/api/tournaments/check-name?name=${encodeURIComponent(normalizedTournamentName)}`, {
					signal: controller.signal,
				})
				const result = await readJson(response)
				if (cancelled) return
				setIsNameAvailable(response.ok && result.available === true)
				setNameCheckMessage(response.ok
					? result.available === true ? t('nameAvailable') : t('nameUnavailable')
					: t('nameCheckFailed'))
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') return
				if (!cancelled) {
					setIsNameAvailable(false)
					setNameCheckMessage(t('nameCheckFailed'))
				}
			} finally {
				if (!cancelled) setIsCheckingName(false)
			}
		}, 400)

		return () => {
			cancelled = true
			controller.abort()
			window.clearTimeout(timeoutId)
		}
	}, [hasValidNameLength, normalizedTournamentName, t])

	const clearFeedback = () => {
		setParticipantError(null)
		setSubmitError(null)
		setSubmitSuccess(null)
		setCreatedTournamentId(null)
		setCreatedTournamentName('')
	}

	const applyAutoMode = () => {
		setValue('participantSource', 'official')
		setValue('groupFormat', 'points')
		setValue('startGameweek', 'GW1')
		setValue('endGameweek', 'GW38')
		setValue('groupNum', '1')
		setValue('knockoutFormat', 'none')
		setValue('qualifiersPerGroup', '')
		clearFeedback()
	}

	const toggleParticipant = (participantId: string, selected: boolean) => {
		if (participantSource === 'official') return
		setSelectedParticipantIds((current) => selected
			? Array.from(new Set([...current, participantId]))
			: current.filter((id) => id !== participantId))
	}

	const toggleAllParticipants = () => {
		if (participantSource === 'official') return
		setSelectedParticipantIds((current) =>
			current.length === participants.length ? [] : participants.map((participant) => participant.id),
		)
	}

	const fetchParticipants = async () => {
		if (!leagueUrlState.valid) {
			setParticipantError(leagueUrlState.message ?? t('leagueUrlInvalid'))
			return
		}
		setIsLoadingParticipants(true)
		setParticipantsLoaded(false)
		clearFeedback()
		try {
			const response = await fetch(`/api/tournaments/participants?leagueUrl=${encodeURIComponent(leagueUrl ?? '')}`)
			const result = await readJson(response)
			if (!response.ok) throw new Error(t('participantsLoadFailed'))
			const rawParticipants = Array.isArray(result.participants) ? result.participants : []
			const fetchedParticipants = rawParticipants.filter((item): item is ParticipantApiItem => {
				if (!item || typeof item !== 'object') return false
				const participant = item as Partial<ParticipantApiItem>
				return /^\d+$/.test(participant.id ?? '') &&
					typeof participant.team === 'string' &&
					typeof participant.manager === 'string' &&
					typeof participant.overallRank === 'number' &&
					Number.isFinite(participant.overallRank) &&
					participant.overallRank >= 0 &&
					typeof participant.totalPoints === 'number' &&
					Number.isFinite(participant.totalPoints) &&
					participant.totalPoints >= 0
			})
			setParticipants(fetchedParticipants)
			setSelectedParticipantIds(participantSource === 'official' ? fetchedParticipants.map((participant) => participant.id) : [])
			setParticipantsLoaded(true)
			setFetchedLeagueUrl(leagueUrl ?? null)
			if (fetchedParticipants.length < 2) setParticipantError(t('leagueNeedsTwo'))
		} catch {
			setParticipantError(t('participantsLoadFailed'))
			setParticipants([])
			setSelectedParticipantIds([])
			setParticipantsLoaded(false)
			setFetchedLeagueUrl(null)
		} finally {
			setIsLoadingParticipants(false)
		}
	}

	const onSubmit = async (data: TournamentFormData) => {
		clearFeedback()
		if (!participantsAreCurrent) {
			setSubmitError(t('fetchBeforeCreate'))
			return
		}
		const participantIds = data.participantSource === 'official'
			? participants.map((participant) => participant.id)
			: selectedParticipantIds
		if (participantIds.length < 2) {
			setSubmitError(t('requiresTwo'))
			return
		}
		if (currentIsCheckingName || currentIsNameAvailable !== true) {
			setSubmitError(t('confirmName'))
			return
		}
		if (!plan.groupReady) {
			setSubmitError(t('completeGroup'))
			return
		}
		if (!plan.knockoutReady) {
			setSubmitError(t('completeKnockout'))
			return
		}

		setIsSubmitting(true)
		try {
			const response = await fetch('/api/tournaments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...data, tournamentType: 'standard', selectedParticipantIds: participantIds }),
			})
			const result = await readJson(response)
			if (!response.ok) throw new Error(t('createFailed'))
			const tournament = result.tournament && typeof result.tournament === 'object'
				? result.tournament as Record<string, unknown>
				: {}
			const tournamentId = typeof tournament.id === 'number' ? tournament.id : null
			const participantCount = typeof tournament.participantCount === 'number' ? tournament.participantCount : participantIds.length
			const setupStatus = result.setupStatus
			setCreatedTournamentId(tournamentId)
			setCreatedTournamentName(data.tournamentName.trim())
			setIsNameAvailable(false)
			setSubmitSuccess(
				setupStatus === 'failed'
					? t('createdFailedSetup', { count: participantCount })
					: setupStatus === 'ready'
						? t('createdReady', { count: participantCount })
						: t('createdProcessing', { count: participantCount }),
			)
		} catch {
			setSubmitError(t('createFailed'))
		} finally {
			setIsSubmitting(false)
		}
	}

	return {
		applyAutoMode,
		createdTournamentId: currentCreatedTournamentId,
		fetchParticipants,
		form,
		groupFormat,
		isCheckingName: currentIsCheckingName,
		isLoadingParticipants,
		isNameAvailable: currentIsNameAvailable,
		isSubmitting,
		knockoutFormat,
		leagueUrl,
		leagueUrlState,
		nameCheckMessage: currentNameCheckMessage,
		onSubmit,
		participantError,
		participants,
		participantsLoaded: participantsAreCurrent,
		participantSource,
		plan,
		selectedParticipantIds: effectiveSelectedParticipantIds,
		submitError,
		submitSuccess: currentSubmitSuccess,
		toggleAllParticipants,
		toggleParticipant,
	}
}
