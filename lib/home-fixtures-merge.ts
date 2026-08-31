import type {
	LiveMatchdayFixtureSummary,
	LiveMatchdaySummarySnapshot
} from '@/lib/graphql/operations/live'
import type {
	HomeFixture,
	HomeFixtureState,
	HomeFixturesResponse
} from '@/lib/graphql/operations/home'

type CoreHomeFixture = Omit<HomeFixture, 'eventId'>

type CoreHomeFixtureContext = {
	season: string
	revision: string
	sourceCheckedAt: string | null
}

export function homeFixtureStateFromLiveState(state: string): HomeFixtureState {
	if (state === 'SETTLED' || state === 'FINALIZED' || state === 'GW_REVIEW') {
		return 'SETTLED'
	}
	if (
		state === 'SCHEDULED' ||
		state === 'PRE_DEADLINE' ||
		state === 'PICKS_WAIT'
	) {
		return 'SCHEDULED'
	}
	return 'LIVE'
}

export function buildHomeLiveFixtureRevision(
	snapshot: Pick<LiveMatchdaySummarySnapshot, 'revisions'>
): string {
	const {
		deskPublicationId,
		deskGeneration,
		lifecycle,
		fixtureIdentity,
		scoreState
	} = snapshot.revisions
	return [
		'live',
		deskPublicationId,
		String(deskGeneration),
		lifecycle,
		fixtureIdentity,
		scoreState
	].join(':')
}

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
 * The matchday publication is allowed to provide short names, while core
 * fixture identity remains authoritative for kickoff and missing metadata.
 */
export function mergeLiveFixturesIntoHomeFixtures(
	rows: readonly LiveMatchdayFixtureSummary[],
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

/**
 * A missing live overlay must not erase the authoritative fixture schedule.
 * Keep the response on the short live cache while making the core fallback
 * explicit in its state and revision.
 */
export function buildLiveCoreFixtureFallback(
	core: CoreHomeFixtureContext,
	eventId: number,
	coreFixtures: readonly CoreHomeFixture[]
): HomeFixturesResponse {
	return {
		season: core.season,
		revision: `core-fallback:${core.revision}`,
		eventId,
		source: 'LIVE',
		state: 'CORE',
		sourceCheckedAt: core.sourceCheckedAt,
		publishedAt: null,
		stale: true,
		fixtures: coreFixtures.map(fixture => ({ ...fixture, eventId }))
	}
}
