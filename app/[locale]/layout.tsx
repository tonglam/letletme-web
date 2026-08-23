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
			const selected = choice.getAttribute('data-theme-choice') === theme;
			choice.setAttribute('aria-checked', selected ? 'true' : 'false');
			if (choice instanceof HTMLElement) choice.tabIndex = selected ? 0 : -1;
		});
	};

	const enableShellControls = () => {
		document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
			picker.removeAttribute('inert');
			picker.setAttribute('aria-disabled', 'false');
		});
		updateThemeControls(readTheme());
	};

	const suppressThemeTransitions = () => {
		const style = document.createElement('style');
		style.setAttribute('data-theme-transition-guard', '');
		style.textContent = '*,*::before,*::after{transition:none!important}';
		document.head.append(style);
		return () => requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
	};

	const applyTheme = (theme, suppressTransitions = false) => {
		const restoreTransitions = suppressTransitions ? suppressThemeTransitions() : null;
		const resolvedTheme = theme === 'system'
			? (colorSchemeQuery.matches ? 'dark' : 'light')
			: theme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
		document.documentElement.style.colorScheme = resolvedTheme;
		updateThemeControls(theme);
		restoreTransitions?.();
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
				applyTheme(theme, true);
				const disclosure = themeChoice.closest(disclosureSelector);
				disclosure?.removeAttribute('open');
				disclosure?.querySelector(':scope > summary')?.focus();
			}
			return;
		}

		const disclosure = target.closest(disclosureSelector);
		if (!disclosure) {
			closeDisclosures();
			return;
		}
		if (target.closest('summary')) closeDisclosures(disclosure);
		const anchor = target.closest('a');
		if (anchor) {
			const modified = event.button !== 0 || event.metaKey || event.ctrlKey ||
				event.shiftKey || event.altKey || anchor.target === '_blank' ||
				anchor.hasAttribute('download');
			if (!modified) {
				queueMicrotask(() => {
					if (!event.defaultPrevented) disclosure.removeAttribute('open');
				});
			}
		} else if (target.closest('[role="radio"]')) {
			disclosure.removeAttribute('open');
		}
	});

	document.addEventListener('keydown', (event) => {
		const target = event.target;
		const radio = target instanceof Element ? target.closest('[role="radio"]') : null;
		const group = radio?.closest('[role="radiogroup"]');
		if (radio && group && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
			const choices = Array.from(group.querySelectorAll('[role="radio"]')).filter(
				(choice) => choice instanceof HTMLElement &&
					!(choice instanceof HTMLButtonElement && choice.disabled) &&
					choice.getAttribute('aria-disabled') !== 'true'
			);
			const currentIndex = choices.indexOf(radio);
			if (currentIndex >= 0 && choices.length > 0) {
				event.preventDefault();
				let nextIndex;
				if (event.key === 'Home') nextIndex = 0;
				else if (event.key === 'End') nextIndex = choices.length - 1;
				else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
					nextIndex = (currentIndex + 1) % choices.length;
				} else {
					nextIndex = (currentIndex - 1 + choices.length) % choices.length;
				}
				choices[nextIndex].focus();
				choices[nextIndex].click();
			}
			return;
		}
		if (event.key === 'Escape') closeDisclosures();
	});

	colorSchemeQuery.addEventListener('change', () => {
		if (readTheme() === 'system') applyTheme('system', true);
	});
	document.addEventListener('DOMContentLoaded', enableShellControls, { once: true });
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
					data-cfasync="false"
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
