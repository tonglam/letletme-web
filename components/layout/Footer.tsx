import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { menuItems } from './config'
import { LogoMark, LogoWordmark } from './Logo'
import { MiniProgramPopover } from './MiniProgramPopover'

export async function Footer() {
	const [t, nav] = await Promise.all([
		getTranslations('Footer'),
		getTranslations('Navigation'),
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
					className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8 sm:grid-cols-4"
				>
					{menuItems.map(group => (
						<div key={group.id}>
							<p className="chyron mb-4 !text-fascia-foreground/70">
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

				<div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-fascia-foreground/50 sm:flex-row sm:items-center sm:justify-between">
					<p>{t('rights', { year: currentYear })}</p>
					<p className="font-display text-xs font-semibold uppercase tracking-[0.18em]">
						{t('builtFor')}
					</p>
				</div>
			</div>
		</footer>
	)
}
