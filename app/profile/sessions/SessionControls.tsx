'use client'

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

async function fetchSessions() {
	return Promise.all([
		authClient.getSession({ query: { disableCookieCache: true } }),
		authClient.listSessions()
	])
}

export default function SessionControls() {
	const locale = useLocale() as AppLocale
	const t = useTranslations('Sessions')
	const [sessions, setSessions] = useState<ListedSession[]>([])
	const [currentToken, setCurrentToken] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [action, setAction] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const loadSessions = useCallback(async () => {
		setError(null)
		try {
			const [current, listed] = await fetchSessions()
			if (current.error || listed.error || !current.data) {
				setError(t('loadFailed'))
				return
			}
			setCurrentToken(current.data.session.token)
			setSessions(listed.data ?? [])
		} catch {
			setError(t('loadFailed'))
		}
	}, [t])

	useEffect(() => {
		let cancelled = false
		void fetchSessions()
			.then(([current, listed]) => {
				if (cancelled) return
				if (current.error || listed.error || !current.data) {
					setError(t('loadFailed'))
					return
				}
				setCurrentToken(current.data.session.token)
				setSessions(listed.data ?? [])
			})
			.catch(() => {
				if (!cancelled) setError(t('loadFailed'))
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [t])

	const revokeOne = async (session: ListedSession) => {
		setAction(session.token)
		setError(null)
		try {
			const { error: revokeError } = await authClient.revokeSession({
				token: session.token
			})
			if (revokeError) throw new Error(t('signOutFailed'))

			if (session.token === currentToken) {
				clearAuthClientState()
				window.location.assign(localizeHref('/auth/login', locale))
				return
			}

			toast.success(t('sessionSignedOut'))
			await loadSessions()
		} catch {
			setError(t('signOutFailed'))
		} finally {
			setAction(null)
		}
	}

	const revokeOthers = async () => {
		setAction('others')
		setError(null)
		try {
			const { error: revokeError } = await authClient.revokeOtherSessions()
			if (revokeError) throw new Error(t('signOutOthersFailed'))
			toast.success(t('otherSessionsSignedOut'))
			await loadSessions()
		} catch {
			setError(t('signOutOthersFailed'))
		} finally {
			setAction(null)
		}
	}

	const revokeAll = async () => {
		setAction('all')
		setError(null)
		try {
			const { error: revokeError } = await authClient.revokeSessions()
			if (revokeError) throw new Error(t('signOutAllFailed'))
			clearAuthClientState()
			window.location.assign(localizeHref('/auth/login', locale))
		} catch {
			setError(t('signOutAllFailed'))
			setAction(null)
		}
	}

	if (loading) {
		return (
			<Card
				className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground"
				aria-live="polite"
			>
				<LoaderCircle className="h-5 w-5 animate-spin" />
				{t('loading')}
			</Card>
		)
	}

	return (
		<div className="space-y-4">
			{error && (
				<Alert
					variant="destructive"
					aria-live="polite"
				>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{sessions.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">{t('empty')}</Card>
			) : (
				<ul
					className="space-y-3"
					aria-label={t('listLabel')}
				>
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
										<div
											className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary"
											aria-hidden="true"
										>
											{current ? (
												<MonitorSmartphone className="h-5 w-5" />
											) : (
												<Laptop className="h-5 w-5" />
											)}
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium">{label}</p>
												{current && (
													<Badge variant="outline">{t('thisDevice')}</Badge>
												)}
											</div>
											<p className="mt-1 text-xs text-muted-foreground">
												{t('lastActive', {
													date: formatDate(session.updatedAt, locale)
												})}
											</p>
											<p className="text-xs text-muted-foreground">
												{t('expires', {
													date: formatDate(session.expiresAt, locale)
												})}
											</p>
										</div>
									</div>
									<Button
										variant="outline"
										size="sm"
										disabled={action !== null}
										onClick={() => void revokeOne(session)}
									>
										<LogOut className="mr-2 h-4 w-4" />
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
						<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
						<div>
							<h2 className="font-semibold">{t('controlsTitle')}</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{t('controlsDescription')}
							</p>
						</div>
					</div>
					<div className="flex shrink-0 flex-col gap-2 sm:items-end">
						<Button
							variant="outline"
							disabled={action !== null || sessions.length <= 1}
							onClick={() => void revokeOthers()}
						>
							{action === 'others' ? t('signingOut') : t('signOutOthers')}
						</Button>

						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									disabled={action !== null || sessions.length === 0}
								>
									{t('signOutEverywhere')}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
									<AlertDialogDescription>
										{t('confirmDescription')}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
									<AlertDialogAction
										className={buttonVariants({ variant: 'destructive' })}
										onClick={() => void revokeAll()}
									>
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
