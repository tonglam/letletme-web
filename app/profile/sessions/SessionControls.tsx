'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { type AppLocale, localizeHref } from '@/i18n/routing'
import { authClient, clearAuthClientState } from '@/lib/auth-client'
import {
	Laptop,
	LoaderCircle,
	LogOut,
	MonitorSmartphone,
	ShieldCheck
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type ListedSession = NonNullable<
	Awaited<ReturnType<typeof authClient.listSessions>>['data']
>[number]

type SessionLoadState =
	| { status: 'loading' }
	| {
			status: 'ready'
			sessions: ListedSession[]
			currentToken: string
	  }
	| { status: 'reauth-required' }
	| { status: 'error' }

function describeDevice(userAgent: string | null | undefined) {
	if (!userAgent) return null

	const platform = /iPhone|iPad/i.test(userAgent)
		? 'iOS'
		: /Android/i.test(userAgent)
			? 'Android'
			: /Macintosh|Mac OS X/i.test(userAgent)
				? 'macOS'
				: /Windows/i.test(userAgent)
					? 'Windows'
					: /Linux/i.test(userAgent)
						? 'Linux'
						: null
	const browser = /Edg\//i.test(userAgent)
		? 'Edge'
		: /OPR\//i.test(userAgent)
			? 'Opera'
			: /Chrome\//i.test(userAgent)
				? 'Chrome'
				: /Firefox\//i.test(userAgent)
					? 'Firefox'
					: /Safari\//i.test(userAgent)
						? 'Safari'
						: null

	return { browser, platform }
}

function formatDate(value: Date | string, locale: AppLocale): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value))
}

function authErrorCode(error: unknown): string | null {
	if (!error || typeof error !== 'object') return null
	const candidate = error as Record<string, unknown>
	for (const value of [
		candidate.code,
		(candidate.body as Record<string, unknown> | undefined)?.code,
		(candidate.data as Record<string, unknown> | undefined)?.code
	]) {
		if (typeof value === 'string' && value.length > 0) return value
	}
	return typeof candidate.message === 'string' &&
		candidate.message.includes('SESSION_NOT_FRESH')
		? 'SESSION_NOT_FRESH'
		: null
}

async function fetchSessions(): Promise<SessionLoadState> {
	try {
		const [current, listed] = await Promise.all([
			authClient.getSession({ query: { disableCookieCache: true } }),
			authClient.listSessions()
		])
		if (
			authErrorCode(current.error) === 'SESSION_NOT_FRESH' ||
			authErrorCode(listed.error) === 'SESSION_NOT_FRESH'
		) {
			return { status: 'reauth-required' }
		}
		if (current.error || listed.error || !current.data) {
			return { status: 'error' }
		}
		return {
			status: 'ready',
			sessions: listed.data ?? [],
			currentToken: current.data.session.token
		}
	} catch (error) {
		return authErrorCode(error) === 'SESSION_NOT_FRESH'
			? { status: 'reauth-required' }
			: { status: 'error' }
	}
}

export default function SessionControls() {
	const locale = useLocale() as AppLocale
	const t = useTranslations('Sessions')
	const [state, setState] = useState<SessionLoadState>({ status: 'loading' })
	const [action, setAction] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const handleActionFailure = useCallback(
		(error: unknown, fallbackMessage: string) => {
			if (authErrorCode(error) === 'SESSION_NOT_FRESH') {
				setActionError(null)
				setState({ status: 'reauth-required' })
				return
			}
			setActionError(fallbackMessage)
		},
		[]
	)

	const loadSessions = useCallback(async () => {
		setActionError(null)
		setState(await fetchSessions())
	}, [])

	useEffect(() => {
		let cancelled = false
		void fetchSessions().then(result => {
			if (!cancelled) setState(result)
		})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === 'loading') {
		return (
			<Card
				className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground"
				role="status"
			>
				<LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
				{t('loading')}
			</Card>
		)
	}

	if (state.status === 'reauth-required') {
		return (
			<>
				<RouteReadyMarker
					name="SESSION_STATE_READY"
					audienceHint="session-hint"
				/>
				<Card className="space-y-4 p-6" role="status">
					<div>
						<h2 className="font-display text-lg font-semibold">
							{t('reauthTitle')}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t('reauthDescription')}
						</p>
					</div>
					<Button asChild>
						<Link href="/auth/login?next=/profile/sessions&reason=reauth">
							{t('reauthAction')}
						</Link>
					</Button>
				</Card>
			</>
		)
	}

	if (state.status === 'error') {
		return (
			<>
				<RouteReadyMarker
					name="SESSION_STATE_READY"
					audienceHint="session-hint"
				/>
				<Alert variant="destructive" role="alert">
					<AlertDescription className="flex flex-wrap items-center justify-between gap-3">
						<span>{t('loadFailed')}</span>
						<Button variant="outline" size="sm" onClick={() => void loadSessions()}>
							{t('retry')}
						</Button>
					</AlertDescription>
				</Alert>
			</>
		)
	}

	const { sessions, currentToken } = state

	const revokeOne = async (session: ListedSession) => {
		setAction(session.token)
		setActionError(null)
		try {
			const { error } = await authClient.revokeSession({ token: session.token })
			if (error) throw error
			if (session.token === currentToken) {
				clearAuthClientState()
				window.location.assign(localizeHref('/auth/login', locale))
				return
			}
			toast.success(t('sessionSignedOut'))
			await loadSessions()
		} catch (error) {
			handleActionFailure(error, t('signOutFailed'))
		} finally {
			setAction(null)
		}
	}

	const revokeOthers = async () => {
		setAction('others')
		setActionError(null)
		try {
			const { error } = await authClient.revokeOtherSessions()
			if (error) throw error
			toast.success(t('otherSessionsSignedOut'))
			await loadSessions()
		} catch (error) {
			handleActionFailure(error, t('signOutOthersFailed'))
		} finally {
			setAction(null)
		}
	}

	const revokeAll = async () => {
		setAction('all')
		setActionError(null)
		try {
			const { error } = await authClient.revokeSessions()
			if (error) throw error
			clearAuthClientState()
			window.location.assign(localizeHref('/auth/login', locale))
		} catch (error) {
			handleActionFailure(error, t('signOutAllFailed'))
		} finally {
			setAction(null)
		}
	}

	return (
		<div className="space-y-4">
			<RouteReadyMarker
				name="SESSION_STATE_READY"
				audienceHint="session-hint"
			/>
			{actionError ? (
				<Alert variant="destructive" role="alert">
					<AlertDescription>{actionError}</AlertDescription>
				</Alert>
			) : null}

			{sessions.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground" role="status">
					{t('empty')}
				</Card>
			) : (
				<ul className="space-y-3" aria-label={t('listLabel')}>
					{sessions.map(session => {
						const current = session.token === currentToken
						const device = describeDevice(session.userAgent)
						const label = device
							? t('deviceLabel', {
									browser: device.browser ?? t('browser'),
									platform: device.platform ?? t('unknownDevice')
								})
							: t('unknownBrowserDevice')
						return (
							<li key={session.id}>
								<Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex min-w-0 gap-3">
										<div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary" aria-hidden="true">
											{current ? <MonitorSmartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium">{label}</p>
												{current ? <Badge variant="outline">{t('thisDevice')}</Badge> : null}
											</div>
											<p className="mt-1 text-xs text-muted-foreground">{t('lastActive', { date: formatDate(session.updatedAt, locale) })}</p>
											<p className="text-xs text-muted-foreground">{t('expires', { date: formatDate(session.expiresAt, locale) })}</p>
										</div>
									</div>
									<Button variant="outline" size="sm" disabled={action !== null} onClick={() => void revokeOne(session)}>
										<LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
										{action === session.token ? t('signingOut') : t('signOut')}
									</Button>
								</Card>
							</li>
						)
					})}
				</ul>
			)}

			<Card className="p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex gap-3">
						<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
						<div>
							<h2 className="font-semibold">{t('controlsTitle')}</h2>
							<p className="mt-1 text-sm text-muted-foreground">{t('controlsDescription')}</p>
						</div>
					</div>
					<div className="flex shrink-0 flex-col gap-2 sm:items-end">
						<Button variant="outline" disabled={action !== null || sessions.length <= 1} onClick={() => void revokeOthers()}>
							{action === 'others' ? t('signingOut') : t('signOutOthers')}
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" disabled={action !== null || sessions.length === 0}>
									{t('signOutEverywhere')}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
									<AlertDialogDescription>{t('confirmDescription')}</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
									<AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => void revokeAll()}>
										{t('signOutEverywhere')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			</Card>
		</div>
	)
}
