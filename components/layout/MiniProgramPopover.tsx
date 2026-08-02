'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { QrCode } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

type MiniProgramPopoverProps = {
	label: string
	scanText: string
}

export function MiniProgramPopover({ label, scanText }: MiniProgramPopoverProps) {
	const [open, setOpen] = useState(false)

	return (
		<div className="w-fit" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						onClick={e => {
							// Hover already opens the popover; stop Radix's toggle so an
							// explicit activation keeps it open instead of closing it.
							e.preventDefault()
							setOpen(true)
						}}
						className="inline-flex items-center gap-2 rounded-md border border-electric/40 bg-white/5 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.18em] text-fascia-foreground/80 transition-colors hover:border-electric hover:text-electric focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
					>
						<QrCode aria-hidden="true" className="size-4 text-electric" />
						{label}
					</button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="end"
					sideOffset={12}
					aria-label={scanText}
					// Content is presentational — keep focus on the trigger so a
					// hover-open never steals focus from another control.
					onOpenAutoFocus={e => e.preventDefault()}
					className="w-auto border-electric/40 bg-fascia p-3 text-fascia-foreground"
				>
					<div className="rounded-md bg-white p-2">
						<Image
							src="/images/miniprogram.webp"
							alt=""
							width={465}
							height={439}
							className="h-auto w-[148px]"
						/>
					</div>
					<p className="mt-2 text-center text-xs text-fascia-foreground/70">{scanText}</p>
				</PopoverContent>
			</Popover>
		</div>
	)
}
