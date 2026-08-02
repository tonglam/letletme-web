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
	LANGUAGE_COOKIE,
	localizeHref,
	stripLocaleFromHref,
} from '@/i18n/routing'
import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

export function LanguageSwitcher() {
	const locale = useLocale()
	const t = useTranslations('Language')
	const [isPending, setIsPending] = useState(false)

	const changeLocale = (nextLocale: string) => {
		if (!isAppLocale(nextLocale) || nextLocale === locale) return

		setIsPending(true)
		const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
		const destination = localizeHref(stripLocaleFromHref(currentHref), nextLocale)
		const secure = window.location.protocol === 'https:' ? '; Secure' : ''
		document.cookie = `${LANGUAGE_COOKIE.name}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=${LANGUAGE_COOKIE.maxAge}; SameSite=Lax${secure}`
		window.location.replace(destination)
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
