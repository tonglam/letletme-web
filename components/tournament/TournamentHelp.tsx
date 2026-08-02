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
import { useTranslations } from 'next-intl'

interface TournamentHelpProps {
	className?: string
}

interface HelpSection {
	title: string
	icon: LucideIcon
	items: string[]
}

export function TournamentHelp({ className }: TournamentHelpProps) {
	const t = useTranslations('TournamentHelp')
	const [isOpen, setIsOpen] = useState(false)
	const helpSections: HelpSection[] = [
		{ title: t('participantsTitle'), icon: Users, items: [t('participantsOne'), t('participantsTwo'), t('participantsThree')] },
		{ title: t('formatTitle'), icon: Trophy, items: [t('formatOne'), t('formatTwo'), t('formatThree')] },
		{ title: t('scheduleTitle'), icon: CalendarRange, items: [t('scheduleOne'), t('scheduleTwo'), t('scheduleThree')] },
		{ title: t('createTitle'), icon: ListChecks, items: [t('createOne'), t('createTwo'), t('createThree')] },
	]
	const faqs = [
		{ question: t('editQuestion'), answer: t('editAnswer') },
		{ question: t('fetchQuestion'), answer: t('fetchAnswer') },
		{ question: t('scheduleQuestion'), answer: t('scheduleAnswer') },
		{ question: t('processingQuestion'), answer: t('processingAnswer') },
	]

	return (
		<div className={className}>
			<Button
				variant="outline"
				onClick={() => setIsOpen(current => !current)}
				aria-expanded={isOpen}
				aria-controls="tournament-help-content"
			>
				<CircleHelp data-icon="inline-start" />
				{isOpen ? t('hide') : t('show')}
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
								{t('setupGuide')}
							</TabsTrigger>
							<TabsTrigger value="faq" className="gap-2">
								<FileQuestion aria-hidden="true" className="size-4" />
								{t('faq')}
							</TabsTrigger>
						</TabsList>

						<TabsContent value="setup" className="space-y-5">
							{helpSections.map(({ title, icon: Icon, items }, index) => (
								<div key={title}>
									<div className="mb-2 flex items-center gap-2">
										<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
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
								<AlertTitle>{t('capabilityTitle')}</AlertTitle>
								<AlertDescription>
									{t('capabilityDescription')}
								</AlertDescription>
							</Alert>
						</TabsContent>
					</Tabs>
				</Card>
			) : null}
		</div>
	)
}
