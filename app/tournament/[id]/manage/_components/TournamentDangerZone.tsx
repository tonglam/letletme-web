'use client'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useState, type MouseEvent } from 'react'

export function TournamentDangerZone({
	isDeleting,
	onDelete,
	tournamentName,
}: {
	isDeleting: boolean
	onDelete: () => Promise<boolean>
	tournamentName: string
}) {
	const [open, setOpen] = useState(false)
	const [confirmation, setConfirmation] = useState('')
	const confirmed = confirmation === tournamentName

	const handleOpenChange = (nextOpen: boolean) => {
		if (isDeleting) return
		setOpen(nextOpen)
		if (!nextOpen) setConfirmation('')
	}

	const handleDelete = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		if (!confirmed || isDeleting) return
		if (await onDelete()) setOpen(false)
	}

	return (
		<Card className="border-destructive/40">
			<CardHeader>
				<CardTitle asChild className="flex items-center gap-2 text-xl text-destructive">
					<h2><TriangleAlert aria-hidden="true" /> Danger zone</h2>
				</CardTitle>
				<CardDescription>
					Deleting a tournament permanently removes its groups, fixtures, results, and statistics.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 rounded-b-lg bg-destructive/5 py-5 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="font-medium">Delete this tournament</p>
					<p className="text-sm text-muted-foreground">This action cannot be undone.</p>
				</div>
				<AlertDialog open={open} onOpenChange={handleOpenChange}>
					<AlertDialogTrigger asChild>
						<Button variant="destructive"><Trash2 aria-hidden="true" /> Delete tournament</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete “{tournamentName}”?</AlertDialogTitle>
							<AlertDialogDescription>
								All tournament data will be removed permanently. Enter the exact tournament name to confirm.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<div className="space-y-2">
							<Label htmlFor="delete-confirmation">Tournament name</Label>
							<Input
								id="delete-confirmation"
								autoComplete="off"
								value={confirmation}
								onChange={event => setConfirmation(event.target.value)}
							/>
						</div>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className={buttonVariants({ variant: 'destructive' })}
								disabled={!confirmed || isDeleting}
								onClick={handleDelete}
							>
								{isDeleting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
								{isDeleting ? 'Deleting…' : 'Delete permanently'}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	)
}
