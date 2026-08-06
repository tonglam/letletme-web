'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_VALUE_HISTORY,
	type PlayerValueHistoryItem,
	type PlayerValueHistoryResponse,
} from '@/lib/graphql/operations/prices'
import {
	SEARCH_PLAYERS_FOR_PICKER,
	type PlayerDirectoryItem,
	type PlayerSearchForPickerResponse,
} from '@/lib/graphql/operations/players'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import { positionBadgeClass } from '@/lib/position-style'
import { Search, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

const MIN_SEARCH_LENGTH = 2
const SEARCH_LIMIT = 20

const positionShort = (position: PlayerDirectoryItem['position']): string => {
	switch (position) {
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEFENDER':
			return 'DEF'
		case 'MIDFIELDER':
			return 'MID'
		case 'FORWARD':
			return 'FWD'
	}
}

export function MarketPlayerLookup() {
	const t = useTranslations('Market')
	const formatter = useFormatter()
	const [searchTerm, setSearchTerm] = useState('')
	const [players, setPlayers] = useState<PlayerDirectoryItem[]>([])
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDirectoryItem | null>(null)
	const [history, setHistory] = useState<PlayerValueHistoryItem[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [isHistoryLoading, setIsHistoryLoading] = useState(false)
	const [searchError, setSearchError] = useState<string | null>(null)
	const [historyError, setHistoryError] = useState<string | null>(null)
	const normalizedSearch = searchTerm.trim()

	useEffect(() => {
		let cancelled = false
		if (normalizedSearch.length < MIN_SEARCH_LENGTH) {
			const resetTimer = window.setTimeout(() => {
				if (cancelled) return
				setPlayers([])
				setSearchError(null)
				setIsSearching(false)
			}, 0)
			return () => {
				cancelled = true
				window.clearTimeout(resetTimer)
			}
		}

		const timer = window.setTimeout(() => {
			void Promise.resolve().then(async () => {
				try {
					setIsSearching(true)
					setSearchError(null)
					const data = await executeQuery<PlayerSearchForPickerResponse>(
						SEARCH_PLAYERS_FOR_PICKER,
						{ search: normalizedSearch, limit: SEARCH_LIMIT, cursor: null },
					)
					if (!cancelled) setPlayers(data.playersForPicker.items)
				} catch (error) {
					console.error('Failed to search the Market player directory:', error)
					if (!cancelled) {
						setPlayers([])
						setSearchError(t('directoryFailed'))
					}
				} finally {
					if (!cancelled) setIsSearching(false)
				}
			})
		}, 250)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [normalizedSearch, t])

	useEffect(() => {
		let cancelled = false
		if (!selectedPlayer) {
			const resetTimer = window.setTimeout(() => {
				if (cancelled) return
				setHistory([])
				setHistoryError(null)
				setIsHistoryLoading(false)
			}, 0)
			return () => {
				cancelled = true
				window.clearTimeout(resetTimer)
			}
		}

		void Promise.resolve().then(async () => {
			try {
				setIsHistoryLoading(true)
				setHistoryError(null)
				const data = await executeQuery<PlayerValueHistoryResponse>(GET_PLAYER_VALUE_HISTORY, {
					playerId: selectedPlayer.id,
				})
				if (!cancelled) {
					setHistory(
						data.playerValueHistory
							.filter(item => item.oldValue > 0)
							.slice(0, 30),
					)
				}
			} catch (error) {
				console.error('Failed to load Market player price history:', error)
				if (!cancelled) {
					setHistory([])
					setHistoryError(t('historyFailed'))
				}
			} finally {
				if (!cancelled) setIsHistoryLoading(false)
			}
		})

		return () => {
			cancelled = true
		}
	}, [selectedPlayer, t])

	const currentPrice = history[0]?.newValue ?? null
	const searchStatus = useMemo(() => {
		if (normalizedSearch.length < MIN_SEARCH_LENGTH) return t('searchPrompt')
		if (isSearching) return t('searchingPlayers')
		if (searchError) return searchError
		if (players.length === 0) return t('noPlayerMatches')
		return t('searchResults', { count: players.length })
	}, [isSearching, normalizedSearch.length, players.length, searchError, t])

	const formatDate = (value: string): string => {
		const date = parseCalendarDate(value.slice(0, 10))
		return date
			? formatter.dateTime(date, {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					timeZone: CALENDAR_DATE_TIME_ZONE,
				})
			: value
	}

	return (
		<div>
			<label htmlFor="market-player-search" className="mb-2 block text-sm font-semibold">
				{t('searchPlayers')}
			</label>
			<div className="relative">
				<Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="market-player-search"
					role="combobox"
					value={searchTerm}
					onChange={event => setSearchTerm(event.target.value)}
					placeholder={t('searchPlaceholder')}
					maxLength={50}
					className="h-11 pl-9 pr-11"
					aria-controls="market-player-results"
					aria-describedby="market-player-search-status"
					aria-expanded={normalizedSearch.length >= MIN_SEARCH_LENGTH}
					aria-autocomplete="list"
				/>
				{searchTerm && (
					<button
						type="button"
						aria-label={t('clearSearch')}
						onClick={() => setSearchTerm('')}
						className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				)}
			</div>
			<p
				id="market-player-search-status"
				role="status"
				aria-live="polite"
				className={`mt-2 text-xs ${searchError ? 'text-destructive' : 'text-muted-foreground'}`}
			>
				{searchStatus}
			</p>

			{normalizedSearch.length >= MIN_SEARCH_LENGTH && players.length > 0 && (
				<ul
					id="market-player-results"
					className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border/80 bg-card shadow-sm"
					aria-label={t('playerResults')}
				>
					{players.map(player => (
						<li key={player.id} className="border-b border-border/60 last:border-b-0">
							<button
								type="button"
								onClick={() => {
									setSelectedPlayer(player)
									setSearchTerm('')
								}}
								className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							>
								<Badge className={positionBadgeClass(positionShort(player.position))}>
									{positionShort(player.position)}
								</Badge>
								<span className="min-w-0 flex-1 truncate text-sm font-medium">
									{player.webName}
								</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{player.team.shortName}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			{selectedPlayer && (
				<div className="mt-6 border-t border-border/60 pt-6">
					<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="chyron">{t('playerPriceHistory')}</p>
							<h3 className="mt-1 font-display text-xl font-bold tracking-tight">
								{selectedPlayer.webName}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{positionShort(selectedPlayer.position)} · {selectedPlayer.team.name}
								{currentPrice !== null
									? ` · £${(currentPrice / 10).toFixed(1)}m`
									: ''}
							</p>
						</div>
						<Button
							variant="outline"
							className="min-h-11"
							onClick={() => setSelectedPlayer(null)}
						>
							{t('clearSelected')}
						</Button>
					</div>

					{historyError ? (
						<p
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
						>
							{historyError}
						</p>
					) : isHistoryLoading ? (
						<p role="status" className="text-sm text-muted-foreground">
							{t('loadingHistory')}
						</p>
					) : history.length === 0 ? (
						<p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
							{t('noHistory', { name: selectedPlayer.webName })}
						</p>
					) : (
						<ol
							className="space-y-2"
							aria-label={t('historyFor', { name: selectedPlayer.webName })}
						>
							{history.map(item => {
								const change = item.newValue - item.oldValue
								return (
									<li
										key={`${item.playerId}-${item.changeDate}`}
										className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 dark:bg-muted/25 sm:grid-cols-[1fr_auto_auto]"
									>
										<div>
											<p className="text-sm font-medium">
												{formatDate(item.changeDate)}
											</p>
											<p className="text-xs text-muted-foreground">
												£{(item.oldValue / 10).toFixed(1)}m → £
												{(item.newValue / 10).toFixed(1)}m
											</p>
										</div>
										<span
											className={`font-display text-sm font-semibold tabular-nums ${
												change > 0 ? 'text-success' : 'text-destructive'
											}`}
										>
											{change > 0 ? '+' : ''}£{(change / 10).toFixed(1)}m
										</span>
										{(item.transfersIn !== null &&
											item.transfersIn !== undefined) ||
										(item.transfersOut !== null &&
											item.transfersOut !== undefined) ? (
											<span className="col-span-2 text-xs text-muted-foreground sm:col-span-1">
												{t('historyTransfers', {
													inCount: formatter.number(item.transfersIn ?? 0),
													outCount: formatter.number(item.transfersOut ?? 0),
												})}
											</span>
										) : null}
									</li>
								)
							})}
						</ol>
					)}
				</div>
			)}
		</div>
	)
}
