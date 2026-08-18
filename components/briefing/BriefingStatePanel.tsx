import { AlertTriangle, CalendarClock, CircleOff, LoaderCircle, Newspaper, Radio } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { AppLocale } from '@/i18n/routing'
import type { BriefingState } from '@/lib/graphql/operations/briefing'

const stateIcon: Record<BriefingState, typeof Newspaper> = {
	READY: Newspaper,
	EMPTY: CircleOff,
	STALE: CalendarClock,
	OFFSEASON: CalendarClock,
	UNAVAILABLE: Radio,
	REMOVED: AlertTriangle,
}

export async function BriefingStatePanel({
	state,
	locale,
}: {
	state: BriefingState
	locale: AppLocale
}) {
	const t = await getTranslations({ locale, namespace: 'Briefing' })
	const Icon = stateIcon[state]
	const key = state.toLowerCase() as Lowercase<BriefingState>

	return (
		<section
			className="fascia texture-grain relative isolate overflow-hidden rounded-2xl border border-fascia-foreground/10 px-5 py-12 text-center shadow-sticker-sm sm:px-10"
			role={state === 'UNAVAILABLE' ? 'alert' : 'status'}
		>
			<div className="pitch-markings pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
			<div className="relative mx-auto max-w-xl">
				<div className="mx-auto flex size-12 items-center justify-center rounded-full border border-electric/40 bg-electric/10 text-electric">
					{state === 'UNAVAILABLE' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
				</div>
				<p className="chyron mt-5 text-electric">{t('statusEyebrow')}</p>
				<h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fascia-foreground sm:text-3xl">
					{t(`${key}Title`)}
				</h1>
				<p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-fascia-foreground/65 sm:text-base">
					{t(`${key}Description`)}
				</p>
			</div>
		</section>
	)
}
