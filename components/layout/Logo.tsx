import { cn } from '@/lib/utils'

/**
 * LetLetMe crest — a football club shield with a ball and jersey-style "LLM"
 * lettering. Always rendered on the plum fascia (header/footer), so the
 * palette is fixed brand plum + electric green + chalk.
 */
export function LogoCrest({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 48 48"
			className={cn('size-9', className)}
			aria-hidden="true"
			fill="none"
		>
			<path
				d="M24 2.6 42 8.3V23.2c0 10.3-7.1 17.3-18 21.4C13.1 40.5 6 33.5 6 23.2V8.3L24 2.6Z"
				fill="hsl(288 100% 11%)"
				stroke="hsl(152 100% 50%)"
				strokeWidth="2.6"
				strokeLinejoin="round"
			/>
			{/* ball */}
			<circle cx="24" cy="17" r="6.4" fill="hsl(152 100% 50%)" />
			<path
				d="M24 13.9l2.95 2.15-1.13 3.47h-3.64l-1.13-3.47L24 13.9Z"
				fill="hsl(288 100% 11%)"
			/>
			<path
				d="M24 10.6v3.3M27 15.9l2.6-1.5M26.4 19.7l2.4 2M21.6 19.7l-2.4 2M21 15.9l-2.6-1.5"
				stroke="hsl(288 100% 11%)"
				strokeWidth="1.1"
				strokeLinecap="round"
			/>
			{/* LLM jersey lettering */}
			<path
				d="M13.5 29.5v7.2h4.4M22 29.5v7.2h4.4M30.5 36.7v-7.2l3 3.9 3-3.9v7.2"
				stroke="hsl(48 33% 96%)"
				strokeWidth="2.4"
				strokeLinecap="square"
				strokeLinejoin="miter"
			/>
		</svg>
	)
}

export function LogoWordmark({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				'font-display text-xl font-bold uppercase leading-none tracking-[0.06em]',
				className,
			)}
		>
			LetLet
			<span className="text-electric">Me</span>
		</span>
	)
}
