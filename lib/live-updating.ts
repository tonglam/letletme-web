import type { LiveContextResponse } from '@/lib/graphql/operations/live'
import type { SeasonPhaseSignal } from '@/lib/season-presentation'

type LiveLifecycleContext = NonNullable<LiveContextResponse['liveContext']>

const officialUpdatingSignals = new Set<SeasonPhaseSignal>([
	'PICKS_WAIT',
	'PICKS_PROBE',
	'PICKS_SYNC',
])

/**
 * FPL's post-deadline picks sync is an expected lifecycle state. It is not a
 * service outage and should not be presented as an error or alert.
 */
export function isOfficialLiveUpdatingSignal(
	signal: SeasonPhaseSignal | null | undefined,
): boolean {
	return signal != null && officialUpdatingSignals.has(signal)
}

export function isOfficialLiveUpdatingContext(
	context:
		| Pick<
				LiveLifecycleContext,
				'producerState' | 'dataAvailability'
		  >
		| null
		| undefined,
): boolean {
	return Boolean(
		context &&
		isOfficialLiveUpdatingSignal(context.producerState) &&
		context.dataAvailability === 'UNAVAILABLE',
	)
}
