import { PlayAgainstCard } from '@/components/card/fixture/PlayAgainstCard'
import { parseISO } from 'date-fns'

export interface FixtureCardProps {
	teamName: string
	teamShortName: string
	againstTeamName: string
	againstTeamShortName: string
	kickoffTime: string
}

function FixtureCard({ fixtures }: { fixtures: FixtureCardProps[] }) {
	return (
		<div className="grid justify-items-stretch gap-2">
			{fixtures.map((data, index) => {
				return (
					<PlayAgainstCard
						key={index}
						homeTeamName={data.teamName}
						homeTeamShortName={data.teamShortName}
						awayTeamName={data.againstTeamName}
						awayTeamShortName={data.againstTeamShortName}
						kickOffTime={parseISO(data.kickoffTime)}
					/>
				)
			})}
		</div>
	)
}

export { FixtureCard }
