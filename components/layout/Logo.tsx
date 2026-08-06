import { cn } from '@/lib/utils'

/**
 * LetLetMe mark — two L's drawn as a climbing staircase with the ball at
 * the peak. LLM climbing: live points and rank going up. The steps inherit
 * `currentColor` (electric on the plum fascia, plum on light surfaces);
 * the ball is always broadcast pink — the memorable anchor of the mark.
 */
export function LogoMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 48 48"
			className={cn('size-9', className)}
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
			<circle cx="41" cy="10.5" r="4.5" fill="hsl(330 100% 58%)" />
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
				'font-display text-xl font-bold uppercase leading-none tracking-[0.06em]',
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
