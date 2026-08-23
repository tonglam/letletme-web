import { Moon, Sun } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

const themeOptions = ['light', 'dark', 'system'] as const

export async function ThemeToggle() {
	const t = await getTranslations('Theme')

	return (
		<details
			data-navigation-disclosure
			className="group relative"
		>
			<summary
				aria-label={t('change')}
				className="relative flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-fascia-foreground hover:bg-fascia-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric [&::-webkit-details-marker]:hidden"
			>
				<Sun
					aria-hidden="true"
					className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
				/>
				<Moon
					aria-hidden="true"
					className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
				/>
				<span className="sr-only">{t('toggle')}</span>
			</summary>
			<div
				role="radiogroup"
				aria-label={t('change')}
				className="absolute right-0 top-full z-50 mt-2 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			>
				{themeOptions.map(option => (
					<button
						key={option}
						type="button"
						role="radio"
						aria-checked={option === 'system'}
						data-theme-choice={option}
						className="block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent aria-checked:bg-accent"
					>
						{t(option)}
					</button>
				))}
			</div>
		</details>
	)
}
