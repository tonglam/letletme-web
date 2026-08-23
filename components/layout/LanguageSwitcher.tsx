'use client'

import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { stripLocaleFromHref, type AppLocale } from '@/i18n/routing'
import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type MouseEvent } from 'react'

export function LanguageSwitcher() {
	const locale = useLocale()
	const pathname = usePathname()
	const router = useRouter()
	const t = useTranslations('Language')
	const [isPending, setIsPending] = useState(false)

	const changeLocale = (
		event: MouseEvent<HTMLAnchorElement>,
		nextLocale: AppLocale
	) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return
		}
		event.preventDefault()
		if (isPending || nextLocale === locale) return

		setIsPending(true)
		event.currentTarget.closest('details')?.removeAttribute('open')
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
				<Languages
					aria-hidden="true"
					className="size-4"
				/>
				<span className="sr-only">{t('change')}</span>
			</summary>
			<div
				role="radiogroup"
				aria-label={t('label')}
				className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			>
				<p className="px-2 py-1.5 text-sm font-semibold">{t('label')}</p>
				<Link
					href={pathname}
					locale="en"
					role="radio"
					aria-checked={locale === 'en'}
					aria-disabled={isPending}
					tabIndex={locale === 'en' ? 0 : -1}
					lang="en"
					onClick={event => changeLocale(event, 'en')}
					className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent aria-disabled:opacity-50"
				>
					{t('english')}
				</Link>
				<Link
					href={pathname}
					locale="zh-CN"
					role="radio"
					aria-checked={locale === 'zh-CN'}
					aria-disabled={isPending}
					tabIndex={locale === 'zh-CN' ? 0 : -1}
					lang="zh-CN"
					onClick={event => changeLocale(event, 'zh-CN')}
					className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent aria-disabled:opacity-50"
				>
					{t('simplifiedChinese')}
				</Link>
			</div>
		</details>
	)
}
