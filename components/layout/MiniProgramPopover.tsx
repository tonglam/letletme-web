import { QrCode } from 'lucide-react'
import Image from 'next/image'

type MiniProgramPopoverProps = {
	label: string
	scanText: string
}

/** Footer-only disclosure that stays fully server rendered until navigation. */
export function MiniProgramPopover({ label, scanText }: MiniProgramPopoverProps) {
	return (
		<details
			data-navigation-disclosure
			className="group relative w-fit"
		>
			<summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-electric/40 bg-fascia-foreground/5 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-caps text-fascia-foreground/80 transition-colors hover:border-electric hover:text-electric focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric [&::-webkit-details-marker]:hidden">
				<QrCode
					aria-hidden="true"
					className="size-4 text-electric"
				/>
				{label}
			</summary>
			<div
				role="group"
				aria-label={scanText}
				className="absolute bottom-full right-0 z-50 mb-3 w-[min(92vw,42rem)] overflow-hidden rounded-md border border-electric/40 bg-card p-2 text-card-foreground shadow-xl"
			>
				<Image
					src="/images/miniprogram-light.png"
					alt={`${label}: ${scanText}`}
					width={1761}
					height={420}
					sizes="(max-width: 44rem) 92vw, 42rem"
					className="block h-auto w-full dark:hidden"
				/>
				<Image
					src="/images/miniprogram-dark.png"
					alt={`${label}: ${scanText}`}
					width={1761}
					height={420}
					sizes="(max-width: 44rem) 92vw, 42rem"
					className="hidden h-auto w-full dark:block"
				/>
			</div>
		</details>
	)
}
