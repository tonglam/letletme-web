'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	BookOpen,
	CalendarRange,
	CircleHelp,
	FileQuestion,
	ListChecks,
	Trophy,
	Users,
	type LucideIcon,
} from 'lucide-react'
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
		<Dialog>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" className={className}>
					<CircleHelp data-icon="inline-start" />
					{t('show')}
				</Button>
			</DialogTrigger>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle>{t('title')}</DialogTitle>
				</DialogHeader>
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
			</DialogContent>
		</Dialog>
	)
}
