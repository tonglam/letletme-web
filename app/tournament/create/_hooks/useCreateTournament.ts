'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
	computeTournamentPlan,
	createTournamentFormSchema,
	DEFAULT_TOURNAMENT_FORM,
	getImportedTournamentName,
	isCurrentLeaguePreviewRequest,
	validateLeagueUrl,
	type LeaguePreview,
	type Participant,
	type ParticipantApiItem,
	type TournamentCreationMode,
	type TournamentFormData
} from '../_lib/tournament-form'
import { useTranslations } from 'next-intl'

async function readJson(response: Response): Promise<Record<string, unknown>> {
	try {
		const payload: unknown = await response.json()
		return payload && typeof payload === 'object' && !Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: {}
	} catch {
		return {}
	}
}

export function useCreateTournament() {
	const t = useTranslations('TournamentCreate')
	const schema = useMemo(
		() =>
			createTournamentFormSchema({
				nameTooShort: t('errors.nameTooShort'),
				nameTooLong: t('errors.nameTooLong'),
				validGameweek: t('errors.validGameweek'),
				validLeagueUrl: t('errors.validLeagueUrl'),
				gameweekOrder: t('errors.gameweekOrder'),
				groupPositive: t('errors.groupPositive'),
				groupInvalid: t('errors.groupInvalid'),
				qualifierPositive: t('errors.qualifierPositive'),
				qualifierInvalid: t('errors.qualifierInvalid')
			}),
		[t]
	)
	const form = useForm<TournamentFormData>({
		resolver: zodResolver(schema),
		defaultValues: DEFAULT_TOURNAMENT_FORM,
		mode: 'onChange'
	})
	const { control, getValues, setValue } = form
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
	const normalizedLeagueUrl = leagueUrl?.trim() ?? ''

	const [creationMode, setCreationMode] =
		useState<TournamentCreationMode>('classic')
	const [participants, setParticipants] = useState<Participant[]>([])
	const [selectedParticipantIds, setSelectedParticipantIds] = useState<
		string[]
	>([])
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
	const [createdTournamentId, setCreatedTournamentId] = useState<number | null>(
		null
	)
	const [createdTournamentName, setCreatedTournamentName] = useState('')
	const [loadedLeague, setLoadedLeague] = useState<LeaguePreview | null>(null)
	const [previewToken, setPreviewToken] = useState<string | null>(null)
	const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null)
	const [previewExpired, setPreviewExpired] = useState(false)
	const creationModeRef = useRef<TournamentCreationMode>('classic')
	const participantRequestIdRef = useRef(0)
	const participantAbortControllerRef = useRef<AbortController | null>(null)

	const leagueUrlState = useMemo(
		() =>
			validateLeagueUrl(
				leagueUrl ?? '',
				{
					domainInvalid: t('domainInvalid'),
					pathInvalid: t('leagueUrlPathInvalid'),
					incomplete: t('leagueUrlIncomplete'),
					classicOnly: t('classicOnly'),
					h2hOnly: t('h2hOnly')
				},
				{
					classicOnly: creationMode === 'classic',
					h2hOnly: creationMode === 'h2h'
				}
			),
		[creationMode, leagueUrl, t]
	)
	const participantsAreCurrent =
		participantsLoaded &&
		fetchedLeagueUrl === normalizedLeagueUrl &&
		previewToken !== null &&
		previewExpiresAt !== null &&
		!previewExpired &&
		(creationMode === 'custom' || loadedLeague?.leagueType === creationMode)
	const effectiveSelectedParticipantIds =
		participantSource === 'official' && participantsAreCurrent
			? participants.map(participant => participant.id)
			: selectedParticipantIds
	const totalEntries = participantsAreCurrent
		? participantSource === 'official'
			? participants.length
			: selectedParticipantIds.length
		: 0
	const plan = useMemo(
		() =>
			computeTournamentPlan(
				{
					groupFormat,
					startGameweek,
					endGameweek,
					groupNum,
					qualifiersPerGroup,
					knockoutFormat
				},
				totalEntries,
				participantsAreCurrent
			),
		[
			endGameweek,
			groupFormat,
			groupNum,
			knockoutFormat,
			participantsAreCurrent,
			qualifiersPerGroup,
			startGameweek,
			totalEntries
		]
	)
	const activeNameCheck = checkedTournamentName === normalizedTournamentName
	const hasValidNameLength =
		normalizedTournamentName.length >= 3 &&
		normalizedTournamentName.length <= 80
	const currentIsCheckingName =
		hasValidNameLength && (!activeNameCheck || isCheckingName)
	const currentIsNameAvailable =
		!hasValidNameLength || !activeNameCheck ? null : isNameAvailable
	const currentNameCheckMessage =
		normalizedTournamentName.length === 0
			? null
			: normalizedTournamentName.length < 3
				? t('errors.nameTooShort')
				: normalizedTournamentName.length > 80
					? t('errors.nameTooLong')
					: activeNameCheck
						? nameCheckMessage
						: t('checkingName')
	const currentSubmitSuccess =
		createdTournamentName === normalizedTournamentName ? submitSuccess : null
	const currentCreatedTournamentId =
		createdTournamentName === normalizedTournamentName
			? createdTournamentId
			: null

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
				const response = await fetch(
					`/api/tournaments/check-name?name=${encodeURIComponent(normalizedTournamentName)}`,
					{
						signal: controller.signal
					}
				)
				const result = await readJson(response)
				if (cancelled) return
				setIsNameAvailable(response.ok && result.available === true)
				setNameCheckMessage(
					response.ok
						? result.available === true
							? t('nameAvailable')
							: t('nameUnavailable')
						: t('nameCheckFailed')
				)
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

	useEffect(() => {
		if (!previewExpiresAt) return
		const delay = Math.max(0, Date.parse(previewExpiresAt) - Date.now())
		const timer = window.setTimeout(() => {
			setPreviewToken(null)
			setPreviewExpiresAt(null)
			setPreviewExpired(true)
			setParticipantsLoaded(false)
			setLoadedLeague(null)
		}, delay)
		return () => window.clearTimeout(timer)
	}, [previewExpiresAt])

	const clearFeedback = () => {
		setParticipantError(null)
		setSubmitError(null)
		setSubmitSuccess(null)
		setCreatedTournamentId(null)
		setCreatedTournamentName('')
	}

	const resetForNewTournament = () => {
		participantRequestIdRef.current += 1
		participantAbortControllerRef.current?.abort()
		participantAbortControllerRef.current = null
		creationModeRef.current = 'classic'
		setCreationMode('classic')
		setParticipants([])
		setSelectedParticipantIds([])
		setParticipantsLoaded(false)
		setFetchedLeagueUrl(null)
		setIsLoadingParticipants(false)
		setIsCheckingName(false)
		setIsNameAvailable(null)
		setNameCheckMessage(null)
		setCheckedTournamentName('')
		setParticipantError(null)
		setSubmitError(null)
		setSubmitSuccess(null)
		setCreatedTournamentId(null)
		setCreatedTournamentName('')
		setLoadedLeague(null)
		setPreviewToken(null)
		setPreviewExpiresAt(null)
		setPreviewExpired(false)
		form.reset(DEFAULT_TOURNAMENT_FORM)
		window.scrollTo({ top: 0, behavior: 'smooth' })
		window.requestAnimationFrame(() => {
			document
				.querySelector<HTMLInputElement>('form input:not([disabled])')
				?.focus()
		})
	}

	const applyOfficialMirrorMode = (
		startEvent = loadedLeague?.startEvent ?? 1
	) => {
		setValue('participantSource', 'official', { shouldValidate: true })
		setValue('groupFormat', 'points', { shouldValidate: true })
		setValue(
			'startGameweek',
			`GW${startEvent}` as TournamentFormData['startGameweek'],
			{ shouldValidate: true }
		)
		setValue('endGameweek', 'GW38', { shouldValidate: true })
		setValue('groupNum', '1', { shouldValidate: true })
		setValue('knockoutFormat', 'none', { shouldValidate: true })
		setValue('qualifiersPerGroup', '', { shouldValidate: true })
	}

	const changeCreationMode = (mode: TournamentCreationMode) => {
		creationModeRef.current = mode
		participantRequestIdRef.current += 1
		participantAbortControllerRef.current?.abort()
		participantAbortControllerRef.current = null
		setIsLoadingParticipants(false)
		setCreationMode(mode)
		if (mode === 'classic' || mode === 'h2h') applyOfficialMirrorMode()
		clearFeedback()
	}

	const applyAutoMode = () => {
		setValue('participantSource', 'official')
		setValue('groupFormat', 'points')
		setValue(
			'startGameweek',
			`GW${loadedLeague?.startEvent ?? 1}` as TournamentFormData['startGameweek']
		)
		setValue('endGameweek', 'GW38')
		setValue('groupNum', '1')
		setValue('knockoutFormat', 'none')
		setValue('qualifiersPerGroup', '')
		clearFeedback()
	}

	const toggleParticipant = (participantId: string, selected: boolean) => {
		if (participantSource === 'official') return
		setSelectedParticipantIds(current =>
			selected
				? Array.from(new Set([...current, participantId]))
				: current.filter(id => id !== participantId)
		)
	}

	const toggleAllParticipants = () => {
		if (participantSource === 'official') return
		setSelectedParticipantIds(current =>
			current.length === participants.length
				? []
				: participants.map(participant => participant.id)
		)
	}

	const fetchParticipants = async () => {
		if (!leagueUrlState.valid) {
			setParticipantError(leagueUrlState.message ?? t('leagueUrlInvalid'))
			return
		}
		participantAbortControllerRef.current?.abort()
		const controller = new AbortController()
		const requestId = participantRequestIdRef.current + 1
		const requestMode = creationModeRef.current
		const requestedLeagueUrl = normalizedLeagueUrl
		participantRequestIdRef.current = requestId
		participantAbortControllerRef.current = controller
		const isCurrentRequest = () =>
			isCurrentLeaguePreviewRequest({
				requestId,
				currentRequestId: participantRequestIdRef.current,
				requestMode,
				currentMode: creationModeRef.current,
				requestedLeagueUrl,
				currentLeagueUrl: getValues('leagueUrl')
			})
		setIsLoadingParticipants(true)
		setParticipantsLoaded(false)
		setLoadedLeague(null)
		setPreviewToken(null)
		setPreviewExpiresAt(null)
		setPreviewExpired(false)
		clearFeedback()
		try {
			const response = await fetch('/api/tournaments/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ leagueUrl: requestedLeagueUrl }),
				signal: controller.signal
			})
			const result = await readJson(response)
			if (!isCurrentRequest()) return
			if (!response.ok) throw new Error(t('participantsLoadFailed'))
			const nextPreviewToken =
				typeof result.previewToken === 'string' ? result.previewToken : null
			if (!nextPreviewToken) throw new Error(t('participantsLoadFailed'))
			setPreviewToken(nextPreviewToken)
			setPreviewExpired(false)
			setPreviewExpiresAt(
				typeof result.expiresAt === 'string' &&
					Number.isFinite(Date.parse(result.expiresAt))
					? result.expiresAt
					: null
			)
			const leagueId =
				typeof result.leagueId === 'number' &&
				Number.isSafeInteger(result.leagueId)
					? result.leagueId
					: null
			const leagueType =
				result.leagueType === 'classic' || result.leagueType === 'h2h'
					? result.leagueType
					: null
			const leagueName =
				typeof result.leagueName === 'string' ? result.leagueName.trim() : ''
			const startEvent =
				typeof result.startEvent === 'number' &&
				Number.isInteger(result.startEvent) &&
				result.startEvent >= 1 &&
				result.startEvent <= 38
					? result.startEvent
					: 1
			if (!leagueId || !leagueType) throw new Error(t('participantsLoadFailed'))
			if (creationMode !== 'custom' && leagueType !== creationMode) {
				throw new Error(t(creationMode === 'h2h' ? 'h2hOnly' : 'classicOnly'))
			}
			const rawParticipants = Array.isArray(result.participants)
				? result.participants
				: []
			const fetchedParticipants = rawParticipants.filter(
				(item): item is ParticipantApiItem => {
					if (!item || typeof item !== 'object') return false
					const participant = item as Partial<ParticipantApiItem>
					return (
						/^\d+$/.test(participant.id ?? '') &&
						typeof participant.team === 'string' &&
						typeof participant.manager === 'string' &&
						typeof participant.overallRank === 'number' &&
						Number.isFinite(participant.overallRank) &&
						participant.overallRank >= 0 &&
						typeof participant.totalPoints === 'number' &&
						Number.isFinite(participant.totalPoints) &&
						participant.totalPoints >= 0
					)
				}
			)
			const leaguePreview: LeaguePreview = {
				leagueId,
				leagueName: leagueName || `FPL League ${leagueId}`,
				leagueType,
				startEvent
			}
			setParticipants(fetchedParticipants)
			setSelectedParticipantIds(
				participantSource === 'official'
					? fetchedParticipants.map(participant => participant.id)
					: []
			)
			setParticipantsLoaded(true)
			setFetchedLeagueUrl(requestedLeagueUrl)
			setLoadedLeague(leaguePreview)
			if (creationMode === 'classic' || creationMode === 'h2h') {
				applyOfficialMirrorMode(startEvent)
				setValue(
					'tournamentName',
					getImportedTournamentName(leaguePreview.leagueName, leagueId),
					{
						shouldDirty: true,
						shouldValidate: true
					}
				)
			}
			if (fetchedParticipants.length < 2)
				setParticipantError(t('leagueNeedsTwo'))
		} catch (error) {
			if (
				!isCurrentRequest() ||
				(error instanceof Error && error.name === 'AbortError')
			)
				return
			setParticipantError(
				error instanceof Error ? error.message : t('participantsLoadFailed')
			)
			setParticipants([])
			setSelectedParticipantIds([])
			setParticipantsLoaded(false)
			setFetchedLeagueUrl(null)
			setLoadedLeague(null)
			setPreviewToken(null)
			setPreviewExpiresAt(null)
			setPreviewExpired(false)
		} finally {
			if (requestId === participantRequestIdRef.current) {
				participantAbortControllerRef.current = null
				setIsLoadingParticipants(false)
			}
		}
	}

	const onSubmit = async (data: TournamentFormData) => {
		clearFeedback()
		if (!participantsAreCurrent) {
			setSubmitError(t('fetchBeforeCreate'))
			return
		}
		if (
			creationMode !== 'custom' &&
			loadedLeague?.leagueType !== creationMode
		) {
			setSubmitError(t(creationMode === 'h2h' ? 'h2hOnly' : 'classicOnly'))
			return
		}
		const participantIds =
			data.participantSource === 'official'
				? participants.map(participant => participant.id)
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
			const payload =
				creationMode === 'classic' || creationMode === 'h2h'
					? {
							...data,
							creationMode,
							participantSource: 'official' as const,
							tournamentType: 'standard',
							leagueUrl: normalizedLeagueUrl,
							groupFormat: 'points' as const,
							startGameweek: `GW${loadedLeague?.startEvent ?? 1}`,
							endGameweek: 'GW38',
							groupNum: '1',
							qualifiersPerGroup: '',
							knockoutFormat: 'none' as const,
							selectedParticipantIds: participantIds,
							previewToken
						}
					: {
							...data,
							creationMode,
							tournamentType: 'standard',
							selectedParticipantIds: participantIds,
							previewToken
						}
			const response = await fetch('/api/tournaments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			const result = await readJson(response)
			if (!response.ok) throw new Error(t('createFailed'))
			const tournament =
				result.tournament && typeof result.tournament === 'object'
					? (result.tournament as Record<string, unknown>)
					: {}
			const tournamentId =
				typeof tournament.id === 'number' && Number.isSafeInteger(tournament.id)
					? tournament.id
					: null
			if (!tournamentId) throw new Error(t('createFailed'))
			const participantCount =
				typeof tournament.participantCount === 'number'
					? tournament.participantCount
					: participantIds.length
			const setupStatus = result.setupStatus
			setCreatedTournamentId(tournamentId)
			setCreatedTournamentName(data.tournamentName.trim())
			setIsNameAvailable(false)
			setSubmitSuccess(
				setupStatus === 'failed'
					? t('createdFailedSetup', { count: participantCount })
					: setupStatus === 'ready'
						? t('createdReady', { count: participantCount })
						: t('createdProcessing', { count: participantCount })
			)
		} catch {
			setSubmitError(t('createFailed'))
		} finally {
			setIsSubmitting(false)
		}
	}

	return {
		applyAutoMode,
		changeCreationMode,
		creationMode,
		createdTournamentId: currentCreatedTournamentId,
		resetForNewTournament,
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
		loadedLeague: participantsAreCurrent ? loadedLeague : null,
		previewToken: participantsAreCurrent ? previewToken : null,
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
		toggleParticipant
	}
}
