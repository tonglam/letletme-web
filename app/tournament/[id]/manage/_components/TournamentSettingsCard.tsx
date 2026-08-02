'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Info, LoaderCircle, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import {
	createTournamentNameSchema,
	type TournamentNameForm,
} from '../_lib/tournament-management'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

export function TournamentSettingsCard({
	currentName,
	isSaving,
	mutationState,
	onSubmit,
}: {
	currentName: string
	isSaving: boolean
	mutationState: { kind: 'idle' | 'success' | 'error'; message: string | null }
	onSubmit: (data: TournamentNameForm) => Promise<boolean>
}) {
	const t = useTranslations('TournamentManage')
	const hydrated = useHydrated()
	const schema = useMemo(() => createTournamentNameSchema({
		tooShort: t('nameTooShort'),
		tooLong: t('nameTooLong'),
	}), [t])
	const {
		formState: { errors, isDirty },
		handleSubmit,
		register,
		reset,
	} = useForm<TournamentNameForm>({
		resolver: zodResolver(schema),
		defaultValues: { name: currentName },
	})

	const submit = handleSubmit(async data => {
		if (await onSubmit(data)) reset({ name: data.name.trim() })
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle asChild className="text-xl">
					<h2>{t('settings')}</h2>
				</CardTitle>
				<CardDescription>
					{t('settingsDescription')}
				</CardDescription>
			</CardHeader>
			<form onSubmit={submit} noValidate aria-busy={!hydrated || isSaving}>
				<CardContent className="space-y-5">
					<Alert variant="info">
						<Info aria-hidden="true" />
						<AlertDescription>
							{t('structureWarning')}
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<Label htmlFor="tournament-name">{t('name')}</Label>
						<Input
							id="tournament-name"
							autoComplete="off"
							aria-describedby={errors.name ? 'tournament-name-error' : 'tournament-name-help'}
							aria-invalid={Boolean(errors.name)}
							disabled={!hydrated || isSaving}
							maxLength={80}
							{...register('name')}
						/>
						{errors.name ? (
							<p id="tournament-name-error" className="text-sm text-destructive">
								{errors.name.message}
							</p>
						) : (
							<p id="tournament-name-help" className="text-sm text-muted-foreground">
								{t('nameHelp')}
							</p>
						)}
					</div>

					{mutationState.message ? (
						<Alert variant={mutationState.kind === 'success' ? 'success' : 'destructive'}>
							{mutationState.kind === 'success' ? (
								<CheckCircle2 aria-hidden="true" />
							) : null}
							<AlertDescription>{mutationState.message}</AlertDescription>
						</Alert>
					) : null}
				</CardContent>
				<CardFooter className="justify-end">
					<Button type="submit" disabled={!hydrated || isSaving || !isDirty}>
						{isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
						{isSaving ? t('saving') : t('saveName')}
					</Button>
				</CardFooter>
			</form>
		</Card>
	)
}
