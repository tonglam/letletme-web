import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, Check, Users } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface TournamentCreateActionsProps {
	canSubmit: boolean
	createdTournamentId: number | null
	isSubmitting: boolean
	participantCount: number
	submitError: string | null
	submitSuccess: string | null
}

export function TournamentCreateActions({ canSubmit, createdTournamentId, isSubmitting, participantCount, submitError, submitSuccess }: TournamentCreateActionsProps) {
	const t = useTranslations('TournamentCreate')
	return (
		<div className="flex flex-col gap-6">
			{submitError || submitSuccess ? (
				<Alert variant={submitError ? 'destructive' : 'success'}>
					{submitError ? <AlertCircle aria-hidden="true" /> : <Check aria-hidden="true" />}
					<AlertDescription>{submitError ?? submitSuccess}</AlertDescription>
				</Alert>
			) : null}

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Users aria-hidden="true" /> {t('participantCount', { count: participantCount || '—' })}</span>
				{createdTournamentId ? (
					<Button asChild size="lg"><Link href={`/tournament/${createdTournamentId}`}>{t('viewTournament')}</Link></Button>
				) : (
					<Button type="submit" size="lg" disabled={!canSubmit || isSubmitting}>
						{isSubmitting ? t('creating') : t('create')} <Check data-icon="inline-end" aria-hidden="true" />
					</Button>
				)}
			</div>
		</div>
	)
}
