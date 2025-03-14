'use client'

import RootLayout from '@/components/layout/RootLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	Info,
	Save,
	Trash2,
	Trophy
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// Form schema for tournament management
const formSchema = z.object({
	tournamentName: z
		.string()
		.min(3, 'Tournament name must be at least 3 characters'),
	adminId: z.string().min(1, 'Manager ID is required'),
	managerName: z.string().min(1, 'Manager name is required')
})

type FormData = z.infer<typeof formSchema>

export default function TournamentDetailClient({
	params
}: {
	params: { id: string }
}) {
	const router = useRouter()
	const tournamentId = params.id
	const [isDeleting, setIsDeleting] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)

	// Mock data for the current tournament
	const mockTournamentData = {
		id: tournamentId,
		name: 'Premier League Fan Cup',
		managerId: '12',
		managerName: 'tong',
		participantCount: 12,
		groupFormat: 'points',
		knockoutFormat: 'single',
		startGameweek: 'GW22',
		endGameweek: 'GW38',
		created: '2024-01-15',
		lastUpdated: '2024-04-10',
		isActive: true
	}

	// Form handling
	const {
		register,
		handleSubmit,
		formState: { errors }
	} = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			tournamentName: mockTournamentData.name,
			adminId: mockTournamentData.managerId,
			managerName: mockTournamentData.managerName
		}
	})

	// Handle form submission
	const onSubmit = (data: FormData) => {
		setIsSaving(true)

		// Simulate API call to update tournament
		setTimeout(() => {
			console.log('Tournament updated:', data)
			setIsSaving(false)
			setSaveSuccess(true)

			// Reset success message after 3 seconds
			setTimeout(() => {
				setSaveSuccess(false)
			}, 3000)
		}, 1000)
	}

	// Handle tournament deletion
	const handleDeleteTournament = () => {
		setIsDeleting(true)

		// Simulate API call to delete tournament
		setTimeout(() => {
			console.log(`Tournament ${tournamentId} deleted`)
			setIsDeleting(false)
			router.push('/tournament/list')
		}, 1500)
	}

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="mb-6">
					<Link
						href="/tournament/list?mine=true"
						className="flex items-center text-primary hover:underline mb-4"
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to My Tournaments
					</Link>

					<div className="flex items-center gap-3">
						<Trophy className="h-8 w-8 text-primary" />
						<h1 className="text-3xl font-bold">Manage Tournament</h1>
					</div>
				</div>

				<Card className="p-6 mb-8">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-xl font-semibold">Tournament Settings</h2>
						<div className="flex items-center text-sm text-muted-foreground">
							<Info className="h-4 w-4 mr-1" />
							<span>ID: {tournamentId}</span>
						</div>
					</div>

					<Alert className="mb-6 bg-blue-50 border-blue-200">
						<Info className="h-4 w-4 text-blue-600" />
						<AlertDescription className="text-blue-800">
							You can edit basic tournament details below. To change tournament
							structure or format, you'll need to create a new tournament.
						</AlertDescription>
					</Alert>

					<form onSubmit={handleSubmit(onSubmit)}>
						<div className="space-y-6">
							<div className="grid gap-3">
								<Label htmlFor="tournament-name">
									Tournament Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id="tournament-name"
									{...register('tournamentName')}
								/>
								{errors.tournamentName && (
									<p className="text-sm text-red-500">
										{errors.tournamentName.message}
									</p>
								)}
							</div>

							<div className="grid gap-3">
								<Label htmlFor="manager-id">
									Manager ID <span className="text-red-500">*</span>
								</Label>
								<Input
									id="manager-id"
									{...register('adminId')}
								/>
								{errors.adminId && (
									<p className="text-sm text-red-500">
										{errors.adminId.message}
									</p>
								)}
							</div>

							<div className="grid gap-3">
								<Label htmlFor="manager-name">
									Manager Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id="manager-name"
									{...register('managerName')}
								/>
								{errors.managerName && (
									<p className="text-sm text-red-500">
										{errors.managerName.message}
									</p>
								)}
							</div>

							{saveSuccess && (
								<Alert className="bg-green-50 border-green-200">
									<AlertCircle className="h-4 w-4 text-green-600" />
									<AlertDescription className="text-green-800">
										Tournament details updated successfully!
									</AlertDescription>
								</Alert>
							)}

							<div className="flex justify-end">
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={isSaving}
								>
									{isSaving ? 'Saving...' : 'Save Changes'}
									<Save className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</form>
				</Card>

				<Card className="p-6 mb-8">
					<h2 className="text-xl font-semibold mb-6">Tournament Information</h2>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-2">
								Tournament Details
							</h3>
							<dl className="space-y-2">
								<div className="flex justify-between">
									<dt className="font-medium">Format:</dt>
									<dd>Standard</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">Participants:</dt>
									<dd>{mockTournamentData.participantCount}</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">Created:</dt>
									<dd>{mockTournamentData.created}</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">Last Updated:</dt>
									<dd>{mockTournamentData.lastUpdated}</dd>
								</div>
							</dl>
						</div>

						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-2">
								Tournament Structure
							</h3>
							<dl className="space-y-2">
								<div className="flex justify-between">
									<dt className="font-medium">Group Stage:</dt>
									<dd>
										{mockTournamentData.groupFormat === 'none'
											? 'No'
											: 'Yes - Points Based'}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">Knockout Stage:</dt>
									<dd>
										{mockTournamentData.knockoutFormat === 'none'
											? 'No'
											: 'Yes - Single Elimination'}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">Start Gameweek:</dt>
									<dd>{mockTournamentData.startGameweek}</dd>
								</div>
								<div className="flex justify-between">
									<dt className="font-medium">End Gameweek:</dt>
									<dd>{mockTournamentData.endGameweek}</dd>
								</div>
							</dl>
						</div>
					</div>

					<Alert className="mt-6 bg-amber-50 border-amber-200">
						<AlertTriangle className="h-4 w-4 text-amber-600" />
						<AlertDescription className="text-amber-800">
							<strong>Note:</strong> Tournament structure settings cannot be
							changed. To modify group or knockout settings, you must create a
							new tournament.
						</AlertDescription>
					</Alert>
				</Card>

				<Card className="p-6 mb-8 border-red-200">
					<h2 className="text-xl font-semibold mb-6 text-red-600">
						Danger Zone
					</h2>

					<div className="bg-red-50 p-4 rounded-lg mb-6">
						<div className="flex gap-3">
							<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
							<div>
								<h3 className="font-medium text-red-800 mb-1">
									Delete Tournament
								</h3>
								<p className="text-red-700 text-sm">
									This action cannot be undone. This will permanently delete the
									tournament, its participants, matches, and all related data.
								</p>
							</div>
						</div>
					</div>

					<div className="flex justify-end">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									className="flex items-center gap-2"
								>
									<Trash2 className="h-4 w-4" />
									Delete Tournament
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
									<AlertDialogDescription>
										This action cannot be undone. This will permanently delete
										the tournament "{mockTournamentData.name}" and remove all
										associated data from our servers.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleDeleteTournament}
										className="bg-red-600 text-white hover:bg-red-700"
										disabled={isDeleting}
									>
										{isDeleting ? 'Deleting...' : 'Yes, Delete Tournament'}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</Card>
			</div>
		</RootLayout>
	)
}
