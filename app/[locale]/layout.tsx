import { WebVitalsReporter } from '@/components/analytics/WebVitalsReporter'
import { AppToaster } from '@/components/feedback/AppToaster'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { APP_URL, localizedAlternates } from '@/i18n/config'
import { routing } from '@/i18n/routing'
import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Barlow } from 'next/font/google'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { Suspense } from 'react'
import '../globals.css'

const barlow = Barlow({
	subsets: ['latin'],
	weight: '700',
	variable: '--font-barlow',
	display: 'swap',
})

type LocaleLayoutProps = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

export function generateStaticParams() {
	return routing.locales.map(locale => ({ locale }))
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) notFound()

	const t = await getTranslations({ locale, namespace: 'Metadata' })

	return {
		metadataBase: APP_URL,
		applicationName: 'LetLetMe',
		title: {
			default: t('title'),
			template: '%s | LetLetMe',
		},
		description: t('description'),
		alternates: localizedAlternates('/', locale),
		icons: {
			icon: [{ url: '/favicon.ico' }],
		},
	}
}

const themeBootstrapScript = `
(() => {
	try {
		const storedTheme = window.localStorage.getItem('theme');
		const theme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
			? storedTheme
			: 'system';
		const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		const resolvedTheme = theme === 'system' ? systemTheme : theme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
		document.documentElement.style.colorScheme = resolvedTheme;
	} catch {}
})();
`

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) notFound()

	setRequestLocale(locale)
	const [messages, t] = await Promise.all([
		getMessages(),
		getTranslations('Common'),
	])

	return (
		<html
			lang={locale}
			className={barlow.variable}
			data-locale={locale}
			data-scroll-behavior="smooth"
			suppressHydrationWarning
		>
			<body className="min-h-svh bg-background font-sans text-foreground antialiased">
				<Script
					id="theme-bootstrap"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
				/>
				<NextIntlClientProvider messages={messages}>
					<ThemeProvider defaultTheme="system" enableSystem disableTransitionOnChange>
						<TooltipProvider>
							<a
								href="#main-content"
								className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
							>
								{t('skipToContent')}
							</a>
							<Navbar />
							<main id="main-content" tabIndex={-1}>
								{children}
							</main>
							<Footer />
							<Suspense>
								<AppToaster />
								<WebVitalsReporter />
							</Suspense>
						</TooltipProvider>
					</ThemeProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	)
}
