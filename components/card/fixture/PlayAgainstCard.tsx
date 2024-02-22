'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PL_TEAMS_LOGO } from '@/lib/config'
import { format } from 'date-fns'

const LOGO_RESOURCE: { [key: string]: string } = {
	ARS: PL_TEAMS_LOGO.ARS_LOGO,
	AVL: PL_TEAMS_LOGO.AVL_LOGO,
	BOU: PL_TEAMS_LOGO.BOU_LOGO,
	BRE: PL_TEAMS_LOGO.BRE_LOGO,
	BHA: PL_TEAMS_LOGO.BHA_LOGO,
	BUR: PL_TEAMS_LOGO.BUR_LOGO,
	CHE: PL_TEAMS_LOGO.CHE_LOGO,
	CRY: PL_TEAMS_LOGO.CRY_LOGO,
	EVE: PL_TEAMS_LOGO.EVE_LOGO,
	FUL: PL_TEAMS_LOGO.FUL_LOGO,
	LIV: PL_TEAMS_LOGO.LIV_LOGO,
	LUT: PL_TEAMS_LOGO.LUT_LOGO,
	MCI: PL_TEAMS_LOGO.MCI_LOGO,
	MUN: PL_TEAMS_LOGO.MUN_LOGO,
	NEW: PL_TEAMS_LOGO.NEW_LOGO,
	NFO: PL_TEAMS_LOGO.NFO_LOGO,
	SHU: PL_TEAMS_LOGO.SHU_LOGO,
	TOT: PL_TEAMS_LOGO.TOT_LOGO,
	WHU: PL_TEAMS_LOGO.WHU_LOGO,
	WOL: PL_TEAMS_LOGO.WOL_LOGO
}

function PlayAgainstCard({
	homeTeamName,
	homeTeamShortName,
	awayTeamName,
	awayTeamShortName,
	kickOffTime
}: {
	homeTeamName: string
	homeTeamShortName: string
	awayTeamName: string
	awayTeamShortName: string
	kickOffTime: Date
}) {
	return (
		<div
			className="flex h-full w-full p-4 items-center justify-items-center outline outline-gray-200 rounded-xl gap-1"
			onClick={() => console.log('todo: handle click event')}
		>
			<div className="hidden">
				<p className="w-full md:w-auto">{homeTeamName}</p>
			</div>
			<div className="md:hidden font-semibold">
				<p>{homeTeamShortName}</p>
			</div>
			<Avatar>
				<AvatarImage
					src={LOGO_RESOURCE[homeTeamShortName]}
					alt={homeTeamShortName}
					width={30}
					height={30}
				/>
				<AvatarFallback>{homeTeamShortName}</AvatarFallback>
			</Avatar>
			<div className="flex flex-col space-y-1 items-center">
				<Badge variant="outline">{format(kickOffTime, 'MMM dd')}</Badge>
				<Badge variant="outline">
					{format(kickOffTime, 'EEE')} {format(kickOffTime, 'HH:mm')}
				</Badge>
			</div>
			<Avatar>
				<AvatarImage
					src={LOGO_RESOURCE[awayTeamShortName]}
					alt={awayTeamShortName}
					width={30}
					height={30}
				/>
				<AvatarFallback>{awayTeamShortName}</AvatarFallback>
			</Avatar>
			<div className="hidden">
				<p>{awayTeamName}</p>
			</div>
			<div className="md:hidden font-semibold">
				<p>{awayTeamShortName}</p>
			</div>
		</div>
	)
}

export { PlayAgainstCard }
