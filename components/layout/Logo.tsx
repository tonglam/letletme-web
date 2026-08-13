import { cn } from '@/lib/utils'

/**
 * LetLetMe mark — two L's drawn as a climbing staircase with the ball at
 * the peak. LLM climbing: live points and rank going up. The steps inherit
 * `currentColor` and default to the adaptive brand ink (plum on light,
 * electric on dark); on the always-dark fascia, `text-electric` wins via
 * twMerge. The ball is always broadcast pink — the memorable anchor.
 */
export function LogoMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 48 48"
			className={cn('size-9 text-plum dark:text-electric', className)}
			aria-hidden="true"
			fill="none"
		>
			<path
				d="M8 38H22V26H34V14"
				stroke="currentColor"
				strokeWidth="6"
				strokeLinecap="square"
				strokeLinejoin="miter"
			/>
			<circle cx="41" cy="10.5" r="4.5" className="fill-pink" />
		</svg>
	)
}

/**
 * Wordmark: LetLetMe with the three brand letters LLM in electric green.
 * (L)et(L)et(M)e — remaining letters inherit the ambient text colour.
 */
export function LogoWordmark({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				'font-display text-xl font-bold uppercase leading-none tracking-wider',
				className,
			)}
		>
			<span className="text-electric">L</span>
			et
			<span className="text-electric">L</span>
			et
			<span className="text-electric">M</span>
			e
		</span>
	)
}
