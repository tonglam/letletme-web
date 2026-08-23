'use client'

import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { stripLocaleFromHref, type AppLocale } from '@/i18n/routing'
import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, type MouseEvent } from 'react'

export function LanguageSwitcher() {
	const locale = useLocale()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const router = useRouter()
	const t = useTranslations('Language')
	const [isPending, setIsPending] = useState(false)
	const [isEnhanced, setIsEnhanced] = useState(false)
	const [hash, setHash] = useState('')
	const search = searchParams.toString()
	const currentHref = `${pathname}${search ? `?${search}` : ''}${hash}`

	useEffect(() => {
		setIsEnhanced(true)
		setHash(window.location.hash)
	}, [])

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
		const browserHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
		// Use next-intl's locale-aware navigation so it synchronizes NEXT_LOCALE
		// before Next.js can reuse a cached RSC segment from the previous locale.
		router.replace(stripLocaleFromHref(browserHref), { locale: nextLocale })
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
					href={currentHref}
					locale="en"
					data-locale-link
					role="radio"
					aria-checked={locale === 'en'}
					aria-disabled={isPending}
					tabIndex={isEnhanced && locale !== 'en' ? -1 : 0}
					lang="en"
					onClick={event => changeLocale(event, 'en')}
					className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent aria-disabled:opacity-50"
				>
					{t('english')}
				</Link>
				<Link
					href={currentHref}
					locale="zh-CN"
					data-locale-link
					role="radio"
					aria-checked={locale === 'zh-CN'}
					aria-disabled={isPending}
					tabIndex={isEnhanced && locale !== 'zh-CN' ? -1 : 0}
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
