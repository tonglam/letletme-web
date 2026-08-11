import { randomUUID } from 'node:crypto'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export class RequestTiming {
	private readonly durations = new Map<string, number>()
	private readonly startedAt: number

	constructor(private readonly now: () => number = () => performance.now()) {
		this.startedAt = this.now()
	}

	start(stage: string): () => void {
		const startedAt = this.now()
		let stopped = false
		return () => {
			if (stopped) return
			stopped = true
			const durationMs = Math.max(0, this.now() - startedAt)
			this.durations.set(stage, (this.durations.get(stage) ?? 0) + durationMs)
		}
	}

	async measure<T>(stage: string, task: () => Promise<T>): Promise<T> {
		const stop = this.start(stage)
		try {
			return await task()
		} finally {
			stop()
		}
	}

	measureSync<T>(stage: string, task: () => T): T {
		const stop = this.start(stage)
		try {
			return task()
		} finally {
			stop()
		}
	}

	elapsedMs(): number {
		return Math.max(0, this.now() - this.startedAt)
	}

	snapshot(): Record<string, number> {
		return Object.fromEntries(
			Array.from(this.durations, ([stage, durationMs]) => [stage, Number(durationMs.toFixed(2))])
		)
	}
}

export function resolveRequestId(
	provided: string | null,
	generate: () => string = randomUUID,
): string {
	return provided && REQUEST_ID_PATTERN.test(provided) ? provided : generate()
}
