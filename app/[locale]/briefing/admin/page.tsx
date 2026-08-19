import { notFound } from 'next/navigation'

import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { getCurrentSession } from '@/lib/session'
import { publishBriefingWeekEditionAction } from './actions'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

const allowed = (email: string | undefined, key: string): boolean =>
	Boolean(
		email &&
		process.env.BRIEFING_ADMIN_ENABLED === 'true' &&
		(process.env[key] ?? '')
			.split(',')
			.map(value => value.trim().toLowerCase())
			.includes(email.trim().toLowerCase())
	)

export default async function BriefingAdminPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const session = await getCurrentSession()
	const user = session?.user as { email?: string } | undefined
	const canEdit = allowed(user?.email, 'BRIEFING_EDITOR_EMAILS')
	const canPublish = allowed(user?.email, 'BRIEFING_PUBLISHER_EMAILS')
	if (!canEdit && !canPublish) notFound()
	const workflow = [
		{ step: '1', label: 'Receipts → Candidates', enabled: canEdit },
		{ step: '2', label: 'Bilingual Story → READY', enabled: canEdit },
		{ step: '3', label: 'Week edition → Publish', enabled: canPublish }
	]

	return (
		<div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
			<header className="fascia pitch-markings texture-grain rounded-2xl border border-fascia-foreground/10 p-6 text-fascia-foreground sm:p-8">
				<p className="chyron text-electric">Briefing control room</p>
				<h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">
					Week publication desk
				</h1>
				<p className="mt-4 max-w-2xl text-sm leading-6 text-fascia-foreground/70">
					Editorial commands are sent server-to-server to Data. Source receipts,
					bilingual copy, rights evidence and publication revisions remain
					authoritative in PostgreSQL.
				</p>
			</header>

			<section className="grid gap-4 lg:grid-cols-3">
				{workflow.map(({ step, label, enabled }) => (
					<div
						key={step}
						className="rounded-xl border bg-card p-5"
					>
						<p className="font-mono text-xs text-primary">STEP {step}</p>
						<p className="mt-2 font-display text-lg font-bold">{label}</p>
						<p className="mt-3 text-sm text-muted-foreground">
							{enabled
								? 'Role enabled for this session.'
								: 'Publisher/editor role not enabled.'}
						</p>
					</div>
				))}
			</section>

			{canPublish ? (
				<section className="rounded-xl border bg-card p-5 sm:p-6">
					<div className="mb-5">
						<p className="eyebrow">Publisher command</p>
						<h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
							Publish a ready edition
						</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Data will reject editions that are not READY, missing either
							locale, missing public rights, or attempting to reuse an old
							revision.
						</p>
					</div>
					<form
						action={publishBriefingWeekEditionAction}
						className="grid gap-4 sm:grid-cols-2"
					>
						{[
							['editionId', 'Ready edition ID'],
							['revision', 'New revision'],
							['publicationId', 'Publication UUID'],
							['sourceCheckedAt', 'Source checked at (ISO)'],
							['publishedAt', 'Publish time (ISO)'],
							['validUntil', 'Valid until (ISO, optional)'],
							['reason', 'Publication reason']
						].map(([name, label]) => (
							<label
								key={name}
								className="grid gap-1 text-sm font-semibold"
							>
								{label}
								<input
									name={name}
									required={name !== 'validUntil'}
									className="rounded-md border bg-background px-3 py-2 font-normal"
								/>
							</label>
						))}
						<div className="sm:col-span-2">
							<button
								type="submit"
								className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
							>
								Publish immutable Week revision
							</button>
						</div>
					</form>
				</section>
			) : null}

			<p className="text-xs text-muted-foreground">
				Locale: {locale}. Public Week pages remain no-store in V1.
			</p>
		</div>
	)
}
