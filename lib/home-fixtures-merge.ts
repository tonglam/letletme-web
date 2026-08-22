import type { LiveMatchdayDeskRow } from '@/lib/graphql/operations/live'
import type { HomeFixture } from '@/lib/graphql/operations/home'

type CoreHomeFixture = Omit<HomeFixture, 'eventId'>

function safeText(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function mergeTeam(
	coreTeam: CoreHomeFixture['homeTeam'] | undefined,
	fallback: {
		id: number
		name: string
		shortName?: string
	}
): CoreHomeFixture['homeTeam'] {
	return {
		id: coreTeam?.id ?? fallback.id,
		name: safeText(coreTeam?.name) || safeText(fallback.name),
		shortName: safeText(coreTeam?.shortName) || safeText(fallback.shortName)
	}
}

/**
 * Keep fixture identity in the core contract and overlay only live facts.
 * The live desk intentionally does not own team abbreviations or kickoff data.
 */
export function mergeLiveFixturesIntoHomeFixtures(
	rows: readonly LiveMatchdayDeskRow[],
	coreFixtures: readonly CoreHomeFixture[]
): HomeFixture[] {
	const coreByFixtureId = new Map(
		coreFixtures.map(fixture => [fixture.id, fixture])
	)

	return rows.map(row => {
		const core = coreByFixtureId.get(row.fixtureId)
		return {
			id: row.fixtureId,
			eventId: row.eventId,
			finished: Boolean(
				row.finished || row.finishedProvisional || core?.finished
			),
			started: Boolean(row.started || core?.started),
			kickoffTime: core?.kickoffTime ?? row.kickoffTime ?? null,
			homeTeam: mergeTeam(core?.homeTeam, {
				id: row.homeTeamId,
				name: row.homeTeamName,
				shortName: row.homeTeamShortName
			}),
			awayTeam: mergeTeam(core?.awayTeam, {
				id: row.awayTeamId,
				name: row.awayTeamName,
				shortName: row.awayTeamShortName
			}),
			homeScore: row.homeScore ?? core?.homeScore ?? null,
			awayScore: row.awayScore ?? core?.awayScore ?? null
		}
	})
}
