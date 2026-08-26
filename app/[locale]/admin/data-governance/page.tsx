import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { getAuthorizationSession } from '@/lib/auth'
import { isPlatformAdminIdentity } from '@/lib/platform-admin'
import {
	getDataGovernanceCases,
	getDataGovernanceOverview,
	getDataGovernanceWindows,
	type DataGovernanceOverview
} from '@/lib/data-governance-client'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const text = (value: unknown, fallback = '—'): string =>
	typeof value === 'string' || typeof value === 'number'
		? String(value)
		: fallback

const durationSeconds = (value: unknown, fallback = '—'): string =>
	typeof value === 'number' && Number.isFinite(value)
		? String(Math.max(0, Math.ceil(value / 1000)))
		: fallback

const dateText = (value: unknown): string => {
	if (!value) return '—'
	const parsed = new Date(String(value))
	return Number.isFinite(parsed.getTime())
		? parsed.toLocaleString('zh-CN', {
				hour12: false,
				timeZone: 'Asia/Shanghai'
			})
		: '—'
}

const statusTone = (value: unknown): string => {
	switch (value) {
		case 'MET':
		case 'HEALTHY':
		case 'BREACHED':
		case 'INVALID':
		case 'DRAIN_ONLY':
		case 'OPEN':
			return 'border-rose-400/30 bg-rose-400/10 text-rose-300'
		case 'PENDING':
		default:
			return 'border-amber-300/30 bg-amber-300/10 text-amber-200'
	}
}

const backlogTone = (value: unknown): string => {
	switch (value) {
		case 'HEALTHY':
			return 'bg-emerald-300'
		case 'BURST':
			return 'bg-amber-300'
		case 'PROVIDER_THROTTLED':
			return 'bg-orange-300'
		case 'NO_CONSUMER':
		case 'POISON_STORM':
		case 'STALLED':
		case 'DEADLINE_RISK':
			return 'bg-rose-400'
		default:
			return 'bg-white/20'
	}
}

const Pill = ({ value }: { value: unknown }) => (
	<span
		className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${statusTone(value)}`}
	>
		{text(value, 'UNKNOWN')}
	</span>
)

const Metric = ({
	label,
	value,
	detail
}: {
	label: string
	value: string
	detail?: string
}) => (
	<div className="rounded-xl border border-white/10 bg-black/20 p-4">
		<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
			{label}
		</p>
		<p className="mt-2 font-display text-3xl font-black tracking-tight text-white">
			{value}
		</p>
		{detail ? <p className="mt-1 text-xs text-white/50">{detail}</p> : null}
	</div>
)

const SectionTitle = ({
	index,
	title,
	note
}: {
	index: string
	title: string
	note: string
}) => (
	<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
				{index}
			</p>
			<h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white">
				{title}
			</h2>
		</div>
		<p className="max-w-xl text-right text-xs leading-5 text-white/45">
			{note}
		</p>
	</div>
)

const QueueRow = ({ value }: { value: unknown }) => {
	const queue = record(value)
	const counts = record(queue.counts)
	const health = record(queue.health)
	return (
		<tr className="border-t border-white/8 text-sm">
			<td className="py-3 pr-3 font-mono text-xs text-cyan-200">
				{text(queue.name)}
			</td>
			<td className="py-3 pr-3">
				<Pill value={health.backlogClass} />
			</td>
			<td className="py-3 pr-3 font-mono text-white/75">
				{text(counts.waiting)}
			</td>
			<td className="py-3 pr-3 font-mono text-white/75">
				{durationSeconds(health.oldestRunnableAgeMs)}
				{health.oldestRunnableAgeMs === null ||
				health.oldestRunnableAgeMs === undefined
					? ''
					: 's'}
			</td>
			<td className="py-3 font-mono text-white/55">
				{durationSeconds(health.drainEtaMs)}
				{health.drainEtaMs === null || health.drainEtaMs === undefined
					? ''
					: 's'}
			</td>
		</tr>
	)
}

const QueueHeatmap = ({
	queues,
	windows,
	available
}: {
	queues: unknown[]
	windows: unknown[]
	available: boolean
}) => {
	if (!available) {
		return (
			<div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-amber-200">
				queue history evidence unavailable
			</div>
		)
	}
	const byQueue = new Map<string, Record<string, unknown>[]>()
	for (const value of windows) {
		const item = record(value)
		const name = typeof item.queueName === 'string' ? item.queueName : null
		if (!name) continue
		const existing = byQueue.get(name) ?? []
		existing.push(item)
		byQueue.set(name, existing)
	}
	return (
		<div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-4 md:grid-cols-2 lg:grid-cols-3">
			{queues.map((value, index) => {
				const queue = record(value)
				const name = text(queue.name, `queue-${index}`)
				const history = (byQueue.get(name) ?? [])
					.sort((a, b) =>
						String(a.windowStart ?? '').localeCompare(
							String(b.windowStart ?? '')
						)
					)
					.slice(-24)
				return (
					<div
						key={`${name}-${index}`}
						className="rounded-lg border border-white/8 bg-[#0a1318] px-3 py-2"
					>
						<div className="flex items-center justify-between gap-3">
							<span className="font-mono text-[10px] text-white/60">
								{name}
							</span>
							<span className="font-mono text-[10px] text-white/35">
								{history.length || 0} samples
							</span>
						</div>
						<div
							className="mt-2 flex h-3 gap-0.5"
							aria-label={`${name} queue health history`}
						>
							{(history.length ? history : [{ backlogClass: 'UNKNOWN' }]).map(
								(sample, sampleIndex) => (
									<span
										key={`${name}-sample-${sampleIndex}`}
										className={`h-3 min-w-1 flex-1 rounded-sm ${backlogTone(sample.backlogClass)}`}
										title={`${text(sample.backlogClass, 'UNKNOWN')} · ${dateText(sample.windowStart)}`}
									/>
								)
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}

const WindowRow = ({ value }: { value: unknown }) => {
	const window = record(value)
	return (
		<tr className="border-t border-white/8 text-sm">
			<td className="py-3 pr-3 font-mono text-xs text-cyan-200">
				{text(window.contractKey)}
			</td>
			<td className="py-3 pr-3 text-white/75">{text(window.scopeKey)}</td>
			<td className="py-3 pr-3">
				<Pill value={window.status} />
			</td>
			<td className="py-3 pr-3 font-mono text-xs text-white/55">
				{dateText(window.dueAt)}
			</td>
			<td className="py-3 font-mono text-xs text-white/55">
				{text(window.breachCode)}
			</td>
		</tr>
	)
}

const latencySeconds = (from: unknown, to: unknown): string => {
	const start = Date.parse(String(from ?? ''))
	const end = Date.parse(String(to ?? ''))
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
		return '—'
	return `${((end - start) / 1000).toFixed(1)}s`
}

export default async function DataGovernancePage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const session = await getAuthorizationSession(await headers()).catch(
		() => null
	)
	if (!session?.user || !isPlatformAdminIdentity(session.user)) notFound()

	const [overviewResult, windowsResult, casesResult] = await Promise.allSettled(
		[
			getDataGovernanceOverview('1h'),
			getDataGovernanceWindows('1h'),
			getDataGovernanceCases()
		]
	)
	const overview: DataGovernanceOverview | null =
		overviewResult.status === 'fulfilled' ? overviewResult.value : null
	const queuesAvailable = Array.isArray(overview?.queues)
	const queueHealthWindowsAvailable = Array.isArray(
		overview?.queueHealthWindows
	)
	const registryAvailable = Array.isArray(overview?.registry)
	const queueValues = queuesAvailable ? array(overview?.queues) : []
	const queueHealthWindows = queueHealthWindowsAvailable
		? array(overview?.queueHealthWindows)
		: []
	const registryValues = registryAvailable ? array(overview?.registry) : []
	const freshnessValue = overview?.freshness
	const freshnessAvailable =
		freshnessValue !== null &&
		typeof freshnessValue === 'object' &&
		!Array.isArray(freshnessValue)
	const freshness = record(freshnessValue)
	const runtime = record(overview?.runtime)
	const consistency = record(overview?.publicationConsistency)
	const windowsResponse =
		windowsResult.status === 'fulfilled' ? windowsResult.value : null
	const freshnessWindowsAvailable =
		windowsResponse?.success === true && Array.isArray(windowsResponse.windows)
	const freshnessWindows = freshnessWindowsAvailable
		? array(windowsResponse?.windows)
		: []
	const casesResponse =
		casesResult.status === 'fulfilled' ? casesResult.value : null
	const casesPayload = casesResponse?.cases
	const casesAvailable = Array.isArray(casesPayload)
	const governanceCases: unknown[] = casesAvailable ? casesPayload : []
	const openGovernanceCases = governanceCases.filter(value => {
		const status = record(value).status
		return (
			status === 'OPEN' ||
			status === 'AUTO_REPAIRING' ||
			status === 'REQUIRES_REVIEW'
		)
	})
	const burn = record(overview?.errorBudgetBurn)
	const burnRate =
		typeof burn.burnRate === 'number' ? burn.burnRate.toFixed(2) : '—'
	const burnCountersAvailable =
		typeof burn.breached === 'number' && typeof burn.eligible === 'number'
	const burnDetail = burnCountersAvailable
		? `${text(burn.breached)} breaches / ${text(burn.eligible)} eligible`
		: 'burn evidence unavailable'
	const latestWindow = record(freshnessWindows[0])
	const generatedAt = overview?.generatedAt ?? null

	return (
		<div className="min-h-svh bg-[#071016] text-white">
			<div className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
				<header className="relative overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#0b2028] p-6 shadow-2xl shadow-cyan-950/30 sm:p-9">
					<div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
					<div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
					<p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">
						Data control room / Asia-Shanghai
					</p>
					<div className="mt-4 flex flex-wrap items-end justify-between gap-5">
						<div>
							<h1 className="font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
								GW governance
							</h1>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
								Eligibility → obligation → queue → PostgreSQL → GraphQL → Web.
								This page is an operator view; it never treats a heartbeat or
								HTTP 200 as a data proof.
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-right">
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
								last evidence pull
							</p>
							<p className="mt-1 font-mono text-xs text-cyan-100">
								{dateText(generatedAt)}
							</p>
							<p className="mt-1 text-[11px] text-white/40">locale: {locale}</p>
						</div>
					</div>
				</header>

				{overview ? (
					<>
						<section>
							<SectionTitle
								index="01 / SLO matrix"
								title="Eligibility & deadlines"
								note="Only eligible windows enter the denominator. NOT_APPLICABLE is visible and excluded; INVALID remains a failure signal."
							/>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
								<Metric
									label="pending"
									value={
										freshnessAvailable ? text(freshness.pending, '—') : '—'
									}
									detail={
										freshnessAvailable
											? 'open windows'
											: 'freshness evidence unavailable'
									}
								/>
								<Metric
									label="breached"
									value={
										freshnessAvailable ? text(freshness.breached, '—') : '—'
									}
									detail={
										freshnessAvailable
											? 'historical breach stays breach'
											: 'freshness evidence unavailable'
									}
								/>
								<Metric
									label="invalid"
									value={
										freshnessAvailable ? text(freshness.invalid, '—') : '—'
									}
									detail={
										freshnessAvailable
											? 'cannot prove denominator'
											: 'freshness evidence unavailable'
									}
								/>
								<Metric
									label="N/A"
									value={
										freshnessAvailable
											? text(freshness.notApplicable, '—')
											: '—'
									}
									detail={
										freshnessAvailable
											? 'late entrants excluded'
											: 'freshness evidence unavailable'
									}
								/>
								<Metric
									label="oldest due"
									value={
										freshnessAvailable
											? dateText(freshness.oldestPendingDueAt)
											: '—'
									}
									detail={
										freshnessAvailable
											? 'Asia/Shanghai display'
											: 'freshness evidence unavailable'
									}
								/>
							</div>
							<div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0b171d] p-4">
								<table className="w-full min-w-[760px] text-left">
									<thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										<tr>
											<th className="pb-3 pr-3">contract</th>
											<th className="pb-3 pr-3">queue</th>
											<th className="pb-3 pr-3">criticality</th>
											<th className="pb-3 pr-3">cadence</th>
											<th className="pb-3">mapping</th>
										</tr>
									</thead>
									<tbody>
										{!registryAvailable ? (
											<tr className="border-t border-white/8 text-sm">
												<td
													colSpan={5}
													className="py-5 text-center font-mono text-xs uppercase tracking-[0.12em] text-amber-200"
												>
													registry evidence unavailable
												</td>
											</tr>
										) : registryValues.length === 0 ? (
											<tr className="border-t border-white/8 text-sm">
												<td
													colSpan={5}
													className="py-5 text-center font-mono text-xs uppercase tracking-[0.12em] text-white/45"
												>
													no contracts reported
												</td>
											</tr>
										) : (
											registryValues.slice(0, 22).map((value, index) => {
												const item = record(value)
												return (
													<tr
														key={`${text(item.contractKey)}-${index}`}
														className="border-t border-white/8 text-sm"
													>
														<td className="py-3 pr-3 font-mono text-xs text-cyan-200">
															{text(item.contractKey)}
														</td>
														<td className="py-3 pr-3 font-mono text-xs text-white/70">
															{text(item.queueName)}
														</td>
														<td className="py-3 pr-3">
															<Pill value={item.criticality} />
														</td>
														<td className="py-3 pr-3 text-white/60">
															{text(item.cadence)}
														</td>
														<td className="py-3 text-xs text-white/50">
															scheduler → consumer evidence
														</td>
													</tr>
												)
											})
										)}
									</tbody>
								</table>
							</div>
						</section>

						<section>
							<SectionTitle
								index="02 / evidence waterfall"
								title="Eligibility to Web"
								note="The latest persisted window is shown as a latency chain. Missing milestones remain visible instead of being collapsed into a green status."
							/>
							{!freshnessWindowsAvailable ? (
								<div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-amber-200">
									freshness window evidence unavailable
								</div>
							) : null}
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
								{[
									['eligible', latestWindow.eligibleAt],
									['obligation', latestWindow.obligationDueAt],
									['PG', latestWindow.pgPublishedAt],
									['Redis', latestWindow.redisSeenAt],
									['GraphQL', latestWindow.graphqlSeenAt],
									['Web', latestWindow.webSeenAt]
								].map(([label, value], index, values) => (
									<div
										key={String(label)}
										className="relative rounded-xl border border-white/10 bg-[#0b171d] p-4"
									>
										{index < values.length - 1 ? (
											<span className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-cyan-300/40 lg:block" />
										) : null}
										<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
											{String(label)}
										</p>
										<p className="mt-2 font-mono text-xs text-cyan-100">
											{dateText(value)}
										</p>
										<p className="mt-1 text-[11px] text-white/45">
											{index === 0
												? 'start clock'
												: latencySeconds(values[index - 1][1], value)}
										</p>
									</div>
								))}
							</div>
							<div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0b171d] p-4">
								<table className="w-full min-w-[860px] text-left">
									<thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										<tr>
											<th className="pb-3 pr-3">contract</th>
											<th className="pb-3 pr-3">scope</th>
											<th className="pb-3 pr-3">status</th>
											<th className="pb-3 pr-3">due</th>
											<th className="pb-3">breach</th>
										</tr>
									</thead>
									<tbody>
										{freshnessWindows.slice(0, 25).map((value, index) => (
											<WindowRow
												key={`${text(record(value).windowId)}-${index}`}
												value={value}
											/>
										))}
									</tbody>
								</table>
							</div>
							<QueueHeatmap
								queues={queueValues}
								windows={queueHealthWindows}
								available={queuesAvailable && queueHealthWindowsAvailable}
							/>
						</section>

						<section>
							<SectionTitle
								index="03 / queue heatmap"
								title="Wait, run & drain"
								note="Backlog state is classified by the queue monitor. Low-priority lanes can drain; critical lanes are never auto-gated."
							/>
							<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0b171d] p-4">
								<table className="w-full min-w-[760px] text-left">
									<thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										<tr>
											<th className="pb-3 pr-3">lane</th>
											<th className="pb-3 pr-3">classification</th>
											<th className="pb-3 pr-3">waiting</th>
											<th className="pb-3 pr-3">oldest runnable</th>
											<th className="pb-3">drain ETA</th>
										</tr>
									</thead>
									<tbody>
										{!queuesAvailable ? (
											<tr className="border-t border-white/8 text-sm">
												<td
													colSpan={5}
													className="py-5 text-center font-mono text-xs uppercase tracking-[0.12em] text-amber-200"
												>
													queue evidence unavailable
												</td>
											</tr>
										) : queueValues.length === 0 ? (
											<tr className="border-t border-white/8 text-sm">
												<td
													colSpan={5}
													className="py-5 text-center font-mono text-xs uppercase tracking-[0.12em] text-white/45"
												>
													no queues reported
												</td>
											</tr>
										) : (
											queueValues.map((value, index) => (
												<QueueRow
													key={`${text(record(value).name)}-${index}`}
													value={value}
												/>
											))
										)}
									</tbody>
								</table>
							</div>
						</section>

						<section>
							<SectionTitle
								index="04 / parity"
								title="Revision agreement"
								note="Producer, Redis, GraphQL and Web must point at the same revision before a window is MET. Runtime SHA is shown beside the evidence, not instead of it."
							/>
							<div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
								<div className="rounded-xl border border-white/10 bg-[#0b171d] p-5">
									<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										publication parity
									</p>
									<div className="mt-4 grid gap-2 sm:grid-cols-2">
										{Object.entries(consistency).map(([key, value]) => (
											<div
												key={key}
												className="flex items-center justify-between rounded-lg border border-white/8 bg-black/15 px-3 py-2"
											>
												<span className="font-mono text-xs text-white/65">
													{key}
												</span>
												<Pill value={value === true ? 'MET' : 'INVALID'} />
											</div>
										))}
									</div>
								</div>
								<div className="rounded-xl border border-white/10 bg-[#0b171d] p-5">
									<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										runtime inventory
									</p>
									<div className="mt-4 space-y-2">
										{Object.entries(runtime).map(([key, value]) => {
											const item = record(value)
											return (
												<div
													key={key}
													className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2"
												>
													<span className="font-mono text-xs text-white/65">
														{key}
													</span>
													<span className="flex items-center gap-2">
														<Pill
															value={
																item.healthy === true ? 'HEALTHY' : 'INVALID'
															}
														/>
														<span className="font-mono text-[10px] text-white/35">
															{text(
																record(item.heartbeat).releaseSha,
																'sha unavailable'
															)}
														</span>
													</span>
												</div>
											)
										})}
									</div>
								</div>
							</div>
						</section>

						<section>
							<SectionTitle
								index="05 / burn & repair"
								title="Error budget & cases"
								note="Shadow-mode windows are retained as historical evidence. Recovered breaches remain breaches, with a separate recovery timestamp and revision."
							/>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
								<Metric
									label={`${text(overview?.window, '1h')} burn`}
									value={burnRate}
									detail={burnDetail}
								/>
								<Metric
									label="target"
									value="99%"
									detail="internal error budget"
								/>
								<Metric
									label="queue samples"
									value={
										queueHealthWindowsAvailable
											? String(queueHealthWindows.length)
											: '—'
									}
									detail={
										queueHealthWindowsAvailable
											? 'minute windows retained'
											: 'queue history evidence unavailable'
									}
								/>
								<Metric
									label="open cases"
									value={
										casesAvailable ? String(openGovernanceCases.length) : '—'
									}
									detail={
										casesAvailable
											? 'deduplicated repair work'
											: 'case evidence unavailable'
									}
								/>
							</div>
							<div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0b171d] p-4">
								<table className="w-full min-w-[800px] text-left">
									<thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
										<tr>
											<th className="pb-3 pr-3">case</th>
											<th className="pb-3 pr-3">contract / lane</th>
											<th className="pb-3 pr-3">error</th>
											<th className="pb-3 pr-3">status</th>
											<th className="pb-3">updated</th>
										</tr>
									</thead>
									<tbody>
										{casesAvailable ? (
											governanceCases.slice(0, 50).map((value, index) => {
												const item = record(value)
												return (
													<tr
														key={`${text(item.caseId)}-${index}`}
														className="border-t border-white/8 text-sm"
													>
														<td className="py-3 pr-3 font-mono text-xs text-cyan-200">
															{text(item.caseId)}
														</td>
														<td className="py-3 pr-3 text-white/70">
															{text(item.contractKey)} / {text(item.lane)}
														</td>
														<td className="py-3 pr-3 font-mono text-xs text-white/55">
															{text(item.errorCode, '—')}
														</td>
														<td className="py-3 pr-3">
															<Pill value={item.status} />
														</td>
														<td className="py-3 font-mono text-xs text-white/45">
															{dateText(item.updatedAt)}
														</td>
													</tr>
												)
											})
										) : (
											<tr className="border-t border-white/8 text-sm">
												<td
													colSpan={5}
													className="py-5 text-center font-mono text-xs uppercase tracking-[0.12em] text-amber-200"
												>
													case evidence unavailable
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</section>
					</>
				) : (
					<section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6">
						<p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-200">
							evidence unavailable
						</p>
						<h2 className="mt-2 font-display text-2xl font-black uppercase">
							Data governance API did not answer
						</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
							The page is fail-closed and does not fabricate queue or freshness
							state. Check the protected Data API route, service key and runtime
							heartbeat before taking any repair action.
						</p>
					</section>
				)}
			</div>
		</div>
	)
}
