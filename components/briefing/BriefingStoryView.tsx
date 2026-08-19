import { ArrowLeft, Clock3, ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { formatBriefingDate } from '@/lib/briefing-format'
import {
	isBriefingState,
	isRenderableBriefingStoryState,
	type BriefingStoryCard,
	type BriefingStoryResponse,
} from '@/lib/graphql/operations/briefing'
import { BriefingStatePanel } from './BriefingStatePanel'

function StoryMeta({ story, locale }: { story: BriefingStoryCard; locale: AppLocale }) {
	const checkedAt = formatBriefingDate(story.sourceCheckedAt, locale, { year: 'numeric' })
	const expiresAt = formatBriefingDate(story.expiresAt, locale, { year: 'numeric' })
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
	const rawState = result.briefingStory?.state ?? 'UNAVAILABLE'
	const state = isBriefingState(rawState) ? rawState : 'UNAVAILABLE'
	const story = result.briefingStory?.story
	if (!isRenderableBriefingStoryState(state) || !story) {
		return <BriefingStatePanel state={state} locale={locale} />
	}

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
			{state === 'CORRECTED' ? (
				<div className="mt-8 rounded-xl border border-electric/30 bg-electric/10 px-5 py-4 text-sm leading-7 text-foreground">
					{t('storyCorrectedNotice')}
				</div>
			) : null}
			<div className="mt-8 rounded-xl border-l-4 border-electric bg-muted/35 px-5 py-4 text-sm leading-7 text-muted-foreground">
				{t('storyContext')}
			</div>
		</article>
	)
}
