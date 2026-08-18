import { ArrowUpRight, CalendarDays, Clock3, ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import type {
	BriefingSection,
	BriefingStoryCard,
	BriefingWeek,
} from '@/lib/graphql/operations/briefing'
import { BriefingStatePanel } from './BriefingStatePanel'

const dateFormatter = (locale: AppLocale) =>
	new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-GB', {
		day: 'numeric',
	month: 'short',
	 hour: '2-digit',
		minute: '2-digit',
	})

const formatDate = (value: string | null, locale: AppLocale) => {
	if (!value) return null
	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) ? dateFormatter(locale).format(timestamp) : null
}

function StorySource({ story, locale }: { story: BriefingStoryCard; locale: AppLocale }) {
	const checkedAt = formatDate(story.sourceCheckedAt, locale)
	return (
		<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
			{story.sourceName ? <span className="font-semibold text-foreground/80">{story.sourceName}</span> : null}
			{checkedAt ? (
				<span className="inline-flex items-center gap-1">
					<Clock3 className="size-3" aria-hidden="true" />
					{checkedAt}
				</span>
			) : null}
			{story.sourceUrl ? (
				<a
					href={story.sourceUrl}
					target="_blank"
					rel="noreferrer noopener"
					className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
				>
					<span className="sr-only">{locale === 'zh-CN' ? '查看来源' : 'View source'}</span>
					<ExternalLink className="size-3" aria-hidden="true" />
				</a>
			) : null}
		</div>
	)
}

function StoryCard({ story, locale, lead = false }: { story: BriefingStoryCard; locale: AppLocale; lead?: boolean }) {
	return (
		<article className={lead ? 'rounded-xl border border-fascia-foreground/10 bg-fascia-foreground/8 p-5 sm:p-7' : 'rounded-xl border bg-card p-4 transition-transform hover:-translate-y-0.5 hover:shadow-sticker-sm sm:p-5'}>
			<p className="eyebrow text-muted-foreground">{lead ? (locale === 'zh-CN' ? '本周主线' : 'Lead dispatch') : (locale === 'zh-CN' ? '现场简报' : 'Field note')}</p>
			<h3 className={lead ? 'mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-fascia-foreground sm:text-3xl' : 'mt-2 font-display text-lg font-bold leading-tight tracking-tight'}>
				<Link href={`/briefing/story/${story.slug}`} className={lead ? 'hover:text-electric' : 'hover:text-primary'}>
					{story.title}
				</Link>
			</h3>
			<p className={lead ? 'mt-3 max-w-2xl text-sm leading-6 text-fascia-foreground/70 sm:text-base' : 'mt-2 text-sm leading-6 text-muted-foreground'}>
				{story.summary}
			</p>
			<StorySource story={story} locale={locale} />
		</article>
	)
}

function Section({ section, locale }: { section: BriefingSection; locale: AppLocale }) {
	return (
		<section aria-labelledby={`briefing-section-${section.key}`}>
			<div className="mb-3 flex items-end justify-between gap-3 border-b border-border pb-2">
				<h2 id={`briefing-section-${section.key}`} className="font-display text-lg font-bold tracking-tight">
					{section.title}
				</h2>
				<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{section.items.length}</span>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{section.items.map(story => <StoryCard key={`${story.id}:${story.storyRevision}`} story={story} locale={locale} />)}
			</div>
		</section>
	)
}

export async function BriefingWeekView({ week, locale }: { week: BriefingWeek; locale: AppLocale }) {
	const t = await getTranslations({ locale, namespace: 'Briefing' })
	if (week.state !== 'READY') return <BriefingStatePanel state={week.state} locale={locale} />

	const lead = week.featured[0] ?? week.sections.flatMap(section => section.items)[0]
	const supporting = week.featured.slice(1)
	const publishedAt = formatDate(week.publishedAt, locale)
	const deadline = formatDate(week.event?.deadlineTime ?? null, locale)

	if (!lead && week.sections.length === 0) return <BriefingStatePanel state="EMPTY" locale={locale} />

	return (
		<div className="space-y-8">
			<section className="fascia pitch-markings texture-grain relative isolate overflow-hidden rounded-2xl border border-fascia-foreground/10 px-5 py-7 text-fascia-foreground shadow-sticker-sm sm:px-8 sm:py-9">
				<div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
					<div>
						<p className="chyron text-electric">{t('statusEyebrow')}</p>
						<h1 className="mt-3 max-w-3xl font-display text-4xl font-black uppercase leading-[0.94] tracking-tight sm:text-6xl">
							{t('weekTitle')}
						</h1>
						<p className="mt-4 max-w-2xl text-sm leading-6 text-fascia-foreground/65 sm:text-base">
							{t('weekIntro')}
						</p>
					</div>
					<div className="grid grid-cols-2 gap-3 border-t border-fascia-foreground/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
						<div>
							<p className="eyebrow text-fascia-foreground/45">{t('edition')}</p>
							<p className="mt-1 font-display text-xl font-bold">{week.event?.name ?? t('editionFallback')}</p>
						</div>
						<div>
							<p className="eyebrow text-fascia-foreground/45">{t('revision')}</p>
							<p className="mt-1 font-mono text-xl font-bold tabular-nums">{week.revision ?? '—'}</p>
						</div>
						{deadline ? <p className="col-span-2 flex items-center gap-2 text-xs text-fascia-foreground/60"><CalendarDays className="size-3.5 text-electric" aria-hidden="true" />{t('deadline', { value: deadline })}</p> : null}
					</div>
				</div>
			</section>

			<div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
				<main className="space-y-8">
					{lead ? <StoryCard story={lead} locale={locale} lead /> : null}
					{supporting.length > 0 ? (
						<section aria-labelledby="briefing-featured-heading">
							<div className="mb-3 flex items-center justify-between border-b border-border pb-2">
								<h2 id="briefing-featured-heading" className="font-display text-lg font-bold">{t('moreFeatured')}</h2>
								<ArrowUpRight className="size-4 text-primary" aria-hidden="true" />
							</div>
							<div className="grid gap-3 sm:grid-cols-2">{supporting.map(story => <StoryCard key={`${story.id}:${story.storyRevision}`} story={story} locale={locale} />)}</div>
						</section>
					) : null}
					{week.sections.map(section => <Section key={section.key} section={section} locale={locale} />)}
				</main>

				<aside className="space-y-4 xl:pt-1">
					<div className="rounded-xl border bg-muted/35 p-4">
						<p className="chyron">{t('editorialDesk')}</p>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">{t('editorialDeskDescription')}</p>
					</div>
					<div className="rounded-xl border bg-card p-4">
						<p className="eyebrow">{t('freshness')}</p>
						<p className="mt-2 flex items-center gap-2 font-display text-sm font-bold"><Clock3 className="size-4 text-primary" aria-hidden="true" />{publishedAt ?? t('publishedUnknown')}</p>
						<p className="mt-2 text-xs leading-5 text-muted-foreground">{t('freshnessDescription')}</p>
					</div>
				</aside>
			</div>
		</div>
	)
}
