import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, Check, Users } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import type { TournamentCreationMode } from '../_lib/tournament-form'

interface TournamentCreateActionsProps {
	canSubmit: boolean
	creationMode: TournamentCreationMode
	createdTournamentId: number | null
	isSubmitting: boolean
	participantCount: number
	submitError: string | null
	submitSuccess: string | null
}

export function TournamentCreateActions({ canSubmit, creationMode, createdTournamentId, isSubmitting, participantCount, submitError, submitSuccess }: TournamentCreateActionsProps) {
	const t = useTranslations('TournamentCreate')
	return (
		<div className="flex flex-col gap-6">
			{submitError || submitSuccess ? (
				<Alert variant={submitError ? 'destructive' : 'success'}>
					{submitError ? <AlertCircle aria-hidden="true" /> : <Check aria-hidden="true" />}
					<AlertDescription>{submitError ?? submitSuccess}</AlertDescription>
				</Alert>
			) : null}

			{/* Spacer so sticky bar doesn't cover the last form card on short viewports */}
			<div className="h-2 sm:h-0" aria-hidden="true" />

			<div
				className="sticky bottom-0 z-20 -mx-4 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<Users aria-hidden="true" />{' '}
						{t('participantCount', { count: participantCount || '—' })}
					</span>
					{createdTournamentId ? (
						<Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
							<Link href={`/tournament/${createdTournamentId}`}>{t('viewTournament')}</Link>
						</Button>
					) : (
						<Button
							type="submit"
							size="lg"
							className="min-h-11 w-full sm:w-auto"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting
								? t('creating')
								: creationMode === 'classic'
									? t('copyClassic')
									: t('create')}{' '}
							<Check data-icon="inline-end" aria-hidden="true" />
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
