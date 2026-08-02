'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
	BookOpen,
	CalendarRange,
	ChevronDown,
	CircleHelp,
	FileQuestion,
	ListChecks,
	Trophy,
	Users,
	type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

interface TournamentHelpProps {
	className?: string
}

interface HelpSection {
	title: string
	icon: LucideIcon
	items: string[]
}

const helpSections: HelpSection[] = [
	{
		title: 'Choose participants',
		icon: Users,
		items: [
			'Fetch a league from an official fantasy.premierleague.com league URL.',
			'Official selection includes every fetched entry; Custom lets you choose a subset.',
			'At least two entries are required before creation.',
		],
	},
	{
		title: 'Choose a format',
		icon: Trophy,
		items: [
			'The current tournament type is Standard.',
			'Use no group stage or a points-race group stage, then optionally add single or double elimination.',
			'The summary on the form shows the team and round counts calculated from your choices.',
		],
	},
	{
		title: 'Check the schedule',
		icon: CalendarRange,
		items: [
			'Group-stage gameweeks must be in order and within the 38-gameweek season.',
			'When enabled, the knockout phase starts after the selected group-stage window.',
			'The form prevents creation when the calculated knockout rounds would run past gameweek 38.',
		],
	},
	{
		title: 'Create and follow setup',
		icon: ListChecks,
		items: [
			'The tournament name is checked before submission.',
			'After creation, the page reports whether backend setup is ready, still processing, or failed.',
			'Viewing is supported; editing and deleting tournaments are not available yet.',
		],
	},
]

const faqs = [
	{
		question: 'Can I edit a tournament after creating it?',
		answer:
			'Not yet. Review the participants, format, and schedule before you create it. The current service supports creation and viewing only.',
	},
	{
		question: 'Why must I fetch a league first?',
		answer:
			'The fetched league supplies the real FPL entry IDs used by the tournament. Custom selection changes which fetched entries are included.',
	},
	{
		question: 'How is the knockout schedule calculated?',
		answer:
			'The form calculates the required rounds from the number of qualifying entries and the selected elimination format, then places them after the group-stage end gameweek.',
	},
	{
		question: 'What if setup is still processing?',
		answer:
			'The tournament has been accepted, but its backend setup is not ready yet. Keep the reported status and check the tournament again later.',
	},
] as const

export function TournamentHelp({ className }: TournamentHelpProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div className={className}>
			<Button
				variant="outline"
				onClick={() => setIsOpen(current => !current)}
				aria-expanded={isOpen}
				aria-controls="tournament-help-content"
			>
				<CircleHelp data-icon="inline-start" />
				{isOpen ? 'Hide help' : 'Show help'}
				<ChevronDown
					data-icon="inline-end"
					className={cn('transition-transform', isOpen && 'rotate-180')}
				/>
			</Button>

			{isOpen ? (
				<Card id="tournament-help-content" className="mt-4 p-4 sm:p-6">
					<Tabs defaultValue="setup">
						<TabsList className="mb-6 grid w-full grid-cols-2">
							<TabsTrigger value="setup" className="gap-2">
								<BookOpen aria-hidden="true" className="size-4" />
								Setup guide
							</TabsTrigger>
							<TabsTrigger value="faq" className="gap-2">
								<FileQuestion aria-hidden="true" className="size-4" />
								FAQ
							</TabsTrigger>
						</TabsList>

						<TabsContent value="setup" className="space-y-5">
							{helpSections.map(({ title, icon: Icon, items }, index) => (
								<div key={title}>
									<div className="mb-2 flex items-center gap-2">
										<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<Icon aria-hidden="true" className="size-4" />
										</span>
										<h3 className="font-semibold">{title}</h3>
									</div>
									<ul className="space-y-1 pl-10 text-sm leading-6 text-muted-foreground">
										{items.map(item => (
											<li key={item} className="list-disc">{item}</li>
										))}
									</ul>
									{index < helpSections.length - 1 ? <Separator className="mt-5" /> : null}
								</div>
							))}
						</TabsContent>

						<TabsContent value="faq" className="space-y-5">
							{faqs.map((faq, index) => (
								<div key={faq.question}>
									<h3 className="font-semibold">{faq.question}</h3>
									<p className="mt-1 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
									{index < faqs.length - 1 ? <Separator className="mt-5" /> : null}
								</div>
							))}
							<Alert variant="info">
								<AlertTitle>Current capability</AlertTitle>
								<AlertDescription>
									Create and view flows are available. Update and delete controls stay hidden until those backend operations exist.
								</AlertDescription>
							</Alert>
						</TabsContent>
					</Tabs>
				</Card>
			) : null}
		</div>
	)
}
