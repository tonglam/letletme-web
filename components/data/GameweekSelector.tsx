'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	buildGameweekValuesDesc,
	canStepGameweek,
	parseGameweekJump,
	resolveSelectedGameweek,
} from '@/lib/gameweek-selector'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

interface GameweekSelectorProps {
	onGameweekChange: (gameweek: number) => void
	className?: string
	currentGameweek: number
	selectedGameweek?: number
	disabled?: boolean
}

export function GameweekSelector({
	onGameweekChange,
	className = '',
	currentGameweek,
	selectedGameweek,
	disabled = false,
}: GameweekSelectorProps) {
	const t = useTranslations('Common')
	const { maxGameweek, selected: effectiveSelectedGameweek } =
		resolveSelectedGameweek(currentGameweek, selectedGameweek)

	// Newest first — current GW sits at the top of a long 1–38 list.
	const gameweeks = useMemo(() => {
		return buildGameweekValuesDesc(maxGameweek).map(i => ({
			value: i,
			label:
				i === currentGameweek
					? t('gameweekCurrentOption', { gameweek: i })
					: t('gameweekOption', { gameweek: i }),
		}))
	}, [currentGameweek, maxGameweek, t])

	const [jumpDraft, setJumpDraft] = useState(String(effectiveSelectedGameweek))

	useEffect(() => {
		setJumpDraft(String(effectiveSelectedGameweek))
	}, [effectiveSelectedGameweek])

	const { prev: canGoPrev, next: canGoNext } = canStepGameweek(
		effectiveSelectedGameweek,
		maxGameweek,
		disabled,
	)

	const commitJump = () => {
		const clamped = parseGameweekJump(jumpDraft, maxGameweek)
		if (clamped === null) {
			setJumpDraft(String(effectiveSelectedGameweek))
			return
		}
		setJumpDraft(String(clamped))
		if (clamped !== effectiveSelectedGameweek) {
			onGameweekChange(clamped)
		}
	}

	return (
		<Card className={cn('p-4', className)}>
			<p className="mb-2 text-sm text-muted-foreground">{t('selectGameweek')}</p>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				{/* Step + select: browse nearby or open the list (newest on top) */}
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="size-10 shrink-0"
						disabled={!canGoPrev}
						onClick={() => onGameweekChange(effectiveSelectedGameweek - 1)}
						aria-label={t('previousGameweek')}
					>
						<ChevronLeft className="size-4" aria-hidden="true" />
					</Button>

					<Select
						value={effectiveSelectedGameweek.toString()}
						onValueChange={value => onGameweekChange(Number.parseInt(value, 10))}
						disabled={disabled}
					>
						<SelectTrigger
							className="min-w-0 flex-1"
							aria-label={t('selectGameweek')}
						>
							<SelectValue placeholder={t('selectGameweek')} />
						</SelectTrigger>
						<SelectContent className="max-h-72">
							{gameweeks.map(gw => (
								<SelectItem key={gw.value} value={gw.value.toString()}>
									{gw.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button
						type="button"
						variant="outline"
						size="icon"
						className="size-10 shrink-0"
						disabled={!canGoNext}
						onClick={() => onGameweekChange(effectiveSelectedGameweek + 1)}
						aria-label={t('nextGameweek')}
					>
						<ChevronRight className="size-4" aria-hidden="true" />
					</Button>
				</div>

				{/* Direct jump: type 12 → Enter / Go */}
				<form
					className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto"
					onSubmit={event => {
						event.preventDefault()
						commitJump()
					}}
				>
					<label className="sr-only" htmlFor="gameweek-jump-input">
						{t('jumpToGameweek')}
					</label>
					<Input
						id="gameweek-jump-input"
						type="number"
						inputMode="numeric"
						min={1}
						max={maxGameweek}
						step={1}
						disabled={disabled}
						value={jumpDraft}
						placeholder={t('gameweekNumberPlaceholder')}
						aria-label={t('jumpToGameweek')}
						className="h-10 w-full tabular-nums sm:w-[5.5rem]"
						onChange={event => setJumpDraft(event.target.value)}
						onBlur={commitJump}
					/>
					<Button
						type="submit"
						variant="secondary"
						size="sm"
						className="h-10 shrink-0 px-3"
						disabled={disabled}
						aria-label={t('jumpToGameweek')}
					>
						{t('jumpToGameweekAction')}
					</Button>
				</form>
			</div>
		</Card>
	)
}
