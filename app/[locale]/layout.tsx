import { WebVitalsReporter } from '@/components/analytics/WebVitalsReporter'
import { AppToaster } from '@/components/feedback/AppToaster'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { APP_URL, localizedAlternates } from '@/i18n/config'
import { routing } from '@/i18n/routing'
import { GLOBAL_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'
import { selectMessages } from '@/i18n/message-selection'
import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import {
	getMessages,
	getTranslations,
	setRequestLocale
} from 'next-intl/server'
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import '../globals.css'

// Keep one real face per family in the critical path. The browser synthesizes
// adjacent weights, avoiding six competing font downloads before first paint.
const barlow = Barlow({
	subsets: ['latin'],
	weight: ['400'],
	variable: '--font-barlow',
	display: 'optional'
})

const barlowCondensed = Barlow_Condensed({
	subsets: ['latin'],
	weight: ['700'],
	variable: '--font-display',
	display: 'optional'
})

const plexMono = IBM_Plex_Mono({
	subsets: ['latin'],
	weight: ['500'],
	variable: '--font-mono',
	display: 'optional',
	preload: false
})

type LocaleLayoutProps = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

const shellBootstrapScript = `
(() => {
	const disclosureSelector = 'details[data-navigation-disclosure]';
	const themeChoices = new Set(['light', 'dark', 'system']);
	const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

	const closeDisclosures = (except) => {
		document.querySelectorAll(disclosureSelector).forEach((disclosure) => {
			if (disclosure !== except) disclosure.removeAttribute('open');
		});
	};

	const readTheme = () => {
		try {
			const storedTheme = window.localStorage.getItem('theme');
			return themeChoices.has(storedTheme) ? storedTheme : 'system';
		} catch {
			return 'system';
		}
	};

	const updateThemeControls = (theme) => {
		document.querySelectorAll('[data-theme-choice]').forEach((choice) => {
			choice.setAttribute(
				'aria-checked',
				choice.getAttribute('data-theme-choice') === theme ? 'true' : 'false'
			);
		});
	};

	const applyTheme = (theme) => {
		const resolvedTheme = theme === 'system'
			? (colorSchemeQuery.matches ? 'dark' : 'light')
			: theme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
		document.documentElement.style.colorScheme = resolvedTheme;
		updateThemeControls(theme);
	};

	try {
		applyTheme(readTheme());
	} catch {}

	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const themeChoice = target.closest('[data-theme-choice]');
		if (themeChoice) {
			const theme = themeChoice.getAttribute('data-theme-choice');
			if (themeChoices.has(theme)) {
				try { window.localStorage.setItem('theme', theme); } catch {}
				applyTheme(theme);
				themeChoice.closest(disclosureSelector)?.removeAttribute('open');
			}
			return;
		}

		const disclosure = target.closest(disclosureSelector);
		if (!disclosure) {
			closeDisclosures();
			return;
		}
		if (target.closest('summary')) closeDisclosures(disclosure);
		if (target.closest('a')) disclosure.removeAttribute('open');
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closeDisclosures();
	});

	colorSchemeQuery.addEventListener('change', () => {
		if (readTheme() === 'system') applyTheme('system');
	});
	document.addEventListener('DOMContentLoaded', () => updateThemeControls(readTheme()), { once: true });
})();
`

export function generateStaticParams() {
	return routing.locales.map(locale => ({ locale }))
}

export async function generateMetadata({
	params
}: LocaleLayoutProps): Promise<Metadata> {
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) notFound()

	const t = await getTranslations({ locale, namespace: 'Metadata' })

	return {
		metadataBase: APP_URL,
		applicationName: 'LetLetMe',
		title: {
			default: t('title'),
			template: '%s | LetLetMe'
		},
		description: t('description'),
		alternates: localizedAlternates('/', locale)
		// The file-based app/icon.svg convention supplies the matchday mark.
	}
}

export default async function LocaleLayout({
	children,
	params
}: LocaleLayoutProps) {
	const { locale } = await params
	if (!hasLocale(routing.locales, locale)) notFound()

	setRequestLocale(locale)
	const [allMessages, t] = await Promise.all([
		getMessages(),
		getTranslations('Common')
	])
	const messages = selectMessages(
		allMessages as IntlMessages,
		GLOBAL_CLIENT_NAMESPACES
	)

	return (
		<html
			lang={locale}
			className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}
			data-locale={locale}
			data-scroll-behavior="smooth"
			suppressHydrationWarning
		>
			<head>
				<script
					id="theme-bootstrap"
					dangerouslySetInnerHTML={{ __html: shellBootstrapScript }}
				/>
			</head>
			<body className="min-h-svh bg-background font-sans text-foreground antialiased">
				<NextIntlClientProvider messages={messages as IntlMessages}>
					<a
						href="#main-content"
						className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
					>
						{t('skipToContent')}
					</a>
					<Navbar />
					<main
						id="main-content"
						tabIndex={-1}
					>
						{children}
					</main>
					<Footer />
					<Suspense>
						<AppToaster />
						<WebVitalsReporter />
					</Suspense>
				</NextIntlClientProvider>
			</body>
		</html>
	)
}
