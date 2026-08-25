import { ReportProblemButton } from '@/components/feedback/ReportProblemButton'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { menuItems } from './config'
import { LogoMark, LogoWordmark } from './Logo'
import { MiniProgramPopover } from './MiniProgramPopover'

export async function Footer() {
	const [t, nav] = await Promise.all([
		getTranslations('Footer'),
		getTranslations('Navigation')
	])
	const currentYear = new Date().getFullYear()

	return (
		<footer className="fascia texture-grain relative mt-16 border-t-2 border-electric">
			<div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-8">
				<div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
					<div className="flex items-center gap-3">
						<LogoMark className="size-11 text-electric" />
						<div>
							<LogoWordmark className="text-lg" />
							<p className="mt-1 text-sm text-fascia-foreground/60">
								{t('tagline')}
							</p>
						</div>
					</div>
					<MiniProgramPopover
						label={t('miniProgram')}
						scanText={t('scanMiniProgram')}
					/>
				</div>

				{/* Same groups/order/links as header menu (menuItems) */}
				<nav
					aria-label={t('navigation')}
					className={
						menuItems.length >= 5
							? 'grid grid-cols-2 gap-8 border-t border-fascia-foreground/10 pt-8 sm:grid-cols-5'
							: 'grid grid-cols-2 gap-8 border-t border-fascia-foreground/10 pt-8 sm:grid-cols-4'
					}
				>
					{menuItems.map(group => (
						<div key={group.id}>
							<p className="chyron mb-4 text-fascia-foreground/70">
								{nav(group.labelKey)}
							</p>
							<ul className="flex flex-col gap-2.5">
								{group.items.map(link => (
									<li key={`${group.id}-${link.labelKey}`}>
										<Link
											href={link.href}
											prefetch={false}
											className="text-sm text-fascia-foreground/60 underline-offset-4 transition-colors hover:text-electric hover:underline"
										>
											{nav(link.labelKey)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className="mt-10 grid gap-2 border-t border-fascia-foreground/10 pt-6 text-sm text-fascia-foreground/50 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
					<p className="sm:justify-self-start">{t('rights', { year: currentYear })}</p>
					<a
						href="https://beian.miit.gov.cn/"
						target="_blank"
						rel="noopener noreferrer"
						className="justify-self-center font-display text-xs font-semibold tracking-wide text-fascia-foreground/60 underline-offset-4 transition-colors hover:text-electric hover:underline"
					>
						{t('icpRecord')}
					</a>
					<p className="font-display text-xs font-semibold uppercase tracking-caps sm:justify-self-end">
						{t('builtFor')}
					</p>
				</div>
			</div>
			<ReportProblemButton
				label={nav('reportProblem')}
				className="fixed bottom-4 right-4 z-40 inline-flex min-h-11 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border-2 border-electric bg-fascia px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground shadow-sticker-sm transition-[background-color,border-color,color,transform] hover:-translate-y-0.5 hover:bg-plum hover:text-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
			/>
		</footer>
	)
}
