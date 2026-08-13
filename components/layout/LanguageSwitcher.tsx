'use client'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={t('change')}
					aria-busy={isPending}
					disabled={isPending}
				>
					<Languages aria-hidden="true" />
					<span className="sr-only">{t('change')}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
					<DropdownMenuRadioItem value="en" lang="en">
						{t('english')}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="zh-CN" lang="zh-CN">
						{t('simplifiedChinese')}
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
