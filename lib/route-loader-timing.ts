import 'server-only'

import { RequestTiming } from '@/lib/request-timing'

type LoaderOutcome =
	| 'ready'
	| 'partial'
	| 'unavailable'
	| 'forbidden'
	| 'redirect-login'
	| 'redirect-bind'

export class RouteLoaderTiming {
	private readonly timing = new RequestTiming()
	private finished = false

	constructor(private readonly route: string) {}

	measure<T>(stage: string, task: () => Promise<T>): Promise<T> {
		return this.timing.measure(stage, task)
	}

	finish(outcome: LoaderOutcome): void {
		if (this.finished) return
		this.finished = true
		console.info('[route-loader]', {
			route: this.route,
			outcome,
			durationMs: Number(this.timing.elapsedMs().toFixed(2)),
			stages: this.timing.snapshot()
		})
	}
}
