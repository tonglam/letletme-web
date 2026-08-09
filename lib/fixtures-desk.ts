import type { Fixture } from '@/lib/graphql/operations/events'

export type FixtureStatus = 'upcoming' | 'live' | 'finished'

export type FixtureDayGroup = {
	dateKey: string
	/** Long date label for section headers */
	label: string
	/** Short label for share / compact UI */
	shortLabel: string
	fixtures: Fixture[]
}

export type FixturesGlance = {
	total: number
	finished: number
	remaining: number
	/** ISO kickoff of next unfinished fixture, or null */
	nextKickoff: string | null
}

export type FixtureFilter = 'all' | 'upcoming' | 'finished'

function pad2(value: number): string {
	return String(value).padStart(2, '0')
}

export function fixtureStatus(fixture: Fixture): FixtureStatus {
	if (fixture.finished) return 'finished'
	if (fixture.started) return 'live'
	return 'upcoming'
}

export function getDateKey(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
	}
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function formatFixtureDayLabel(
	date: Date,
	useLocalTime: boolean,
	locale: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

export function formatFixtureDayShort(
	date: Date,
	useLocalTime: boolean,
	locale: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

export function formatFixtureTime(
	date: Date,
	useLocalTime: boolean,
	locale: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

export function groupFixturesByDay(
	fixtures: Fixture[],
	opts: { useLocalTime: boolean; locale: string },
): FixtureDayGroup[] {
	const byDate = new Map<string, Fixture[]>()
	for (const fixture of fixtures) {
		if (!fixture.kickoffTime) continue
		const dateKey = getDateKey(new Date(fixture.kickoffTime), opts.useLocalTime)
		const list = byDate.get(dateKey) ?? []
		list.push(fixture)
		byDate.set(dateKey, list)
	}

	return Array.from(byDate.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, dayFixtures]) => {
			const sorted = [...dayFixtures].sort(
				(a, b) =>
					new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
			)
			const first = new Date(sorted[0]!.kickoffTime)
			return {
				dateKey: getDateKey(first, opts.useLocalTime),
				label: formatFixtureDayLabel(first, opts.useLocalTime, opts.locale),
				shortLabel: formatFixtureDayShort(first, opts.useLocalTime, opts.locale),
				fixtures: sorted,
			}
		})
}

export function buildFixturesGlance(fixtures: Fixture[]): FixturesGlance {
	let finished = 0
	let nextKickoff: string | null = null
	let nextTs = Number.POSITIVE_INFINITY

	for (const f of fixtures) {
		if (fixtureStatus(f) === 'finished') {
			finished += 1
			continue
		}
		if (!f.kickoffTime) continue
		const ts = new Date(f.kickoffTime).getTime()
		if (Number.isFinite(ts) && ts < nextTs) {
			nextTs = ts
			nextKickoff = f.kickoffTime
		}
	}

	const total = fixtures.length
	return {
		total,
		finished,
		remaining: Math.max(0, total - finished),
		nextKickoff,
	}
}

export function filterFixtures(
	fixtures: Fixture[],
	filter: FixtureFilter,
): Fixture[] {
	if (filter === 'all') return fixtures
	if (filter === 'finished') {
		return fixtures.filter(f => fixtureStatus(f) === 'finished')
	}
	// upcoming = not finished (includes live)
	return fixtures.filter(f => fixtureStatus(f) !== 'finished')
}

export function filterDayGroups(
	groups: FixtureDayGroup[],
	filter: FixtureFilter,
): FixtureDayGroup[] {
	if (filter === 'all') return groups
	return groups
		.map(g => ({
			...g,
			fixtures: filterFixtures(g.fixtures, filter),
		}))
		.filter(g => g.fixtures.length > 0)
}
