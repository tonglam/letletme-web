'use client'

import {
	isAppLocale,
	stripLocaleFromHref,
} from '@/i18n/routing'
import { useRouter } from '@/i18n/navigation'
import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

export function LanguageSwitcher() {
	const locale = useLocale()
	const router = useRouter()
	const t = useTranslations('Language')
	const [isPending, setIsPending] = useState(false)

	const changeLocale = (nextLocale: string) => {
		if (!isAppLocale(nextLocale) || nextLocale === locale) return

		setIsPending(true)
		const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
		// Use next-intl's locale-aware navigation so it synchronizes NEXT_LOCALE
		// before Next.js can reuse a cached RSC segment from the previous locale.
		router.replace(stripLocaleFromHref(currentHref), { locale: nextLocale })
	}

	return (
		<details
			data-navigation-disclosure
			className="group relative"
		>
			<summary
				aria-label={t('change')}
				aria-busy={isPending}
				className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-fascia-foreground hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden"
			>
				<Languages aria-hidden="true" className="size-4" />
				<span className="sr-only">{t('change')}</span>
			</summary>
			<div
				role="radiogroup"
				aria-label={t('label')}
				className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			>
				<p className="px-2 py-1.5 text-sm font-semibold">{t('label')}</p>
				<button
					type="button"
					role="radio"
					aria-checked={locale === 'en'}
					lang="en"
					disabled={isPending}
					onClick={() => changeLocale('en')}
					className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent disabled:opacity-50"
				>
					{t('english')}
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={locale === 'zh-CN'}
					lang="zh-CN"
					disabled={isPending}
					onClick={() => changeLocale('zh-CN')}
					className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent disabled:opacity-50"
				>
					{t('simplifiedChinese')}
				</button>
			</div>
		</details>
	)
}
