import { ArrowLeft, Clock3, ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import type { BriefingStoryCard, BriefingStoryResponse } from '@/lib/graphql/operations/briefing'
import { BriefingStatePanel } from './BriefingStatePanel'

const formatDate = (value: string | null, locale: AppLocale) => {
	if (!value) return null
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return null
	return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(timestamp)
}

function StoryMeta({ story, locale }: { story: BriefingStoryCard; locale: AppLocale }) {
	const checkedAt = formatDate(story.sourceCheckedAt, locale)
	const expiresAt = formatDate(story.expiresAt, locale)
	return (
		<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-xs text-muted-foreground">
			{story.sourceName ? <span className="font-semibold text-foreground/80">{story.sourceName}</span> : null}
			{checkedAt ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{checkedAt}</span> : null}
			{expiresAt ? <span>{locale === 'zh-CN' ? `有效至 ${expiresAt}` : `Valid until ${expiresAt}`}</span> : null}
			{story.sourceUrl ? <a href={story.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">{locale === 'zh-CN' ? '打开原文' : 'Open source'}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : null}
		</div>
	)
}

export async function BriefingStoryView({ result, locale }: { result: BriefingStoryResponse; locale: AppLocale }) {
	const t = await getTranslations({ locale, namespace: 'Briefing' })
	const state = result.briefingStory?.state ?? 'UNAVAILABLE'
	const story = result.briefingStory?.story
	if (state !== 'READY' || !story) return <BriefingStatePanel state={state} locale={locale} />

	return (
		<article className="mx-auto max-w-4xl">
			<Link href="/briefing/week" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
				<ArrowLeft className="size-4" aria-hidden="true" />
				{t('backToWeek')}
			</Link>
			<div className="mt-6 border-b pb-8">
				<p className="chyron">{t('storyEyebrow')}</p>
				<h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">{story.title}</h1>
				<p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{story.summary}</p>
				<StoryMeta story={story} locale={locale} />
			</div>
			<div className="mt-8 rounded-xl border-l-4 border-electric bg-muted/35 px-5 py-4 text-sm leading-7 text-muted-foreground">
				{t('storyContext')}
			</div>
		</article>
	)
}
