import {
	buildIngressContextHeadersV2,
	buildOpaqueAbuseSubject,
	buildOpaqueMiniDeviceSubject,
	buildOpaqueRateLimitSubject,
	type GraphQLWorkload
} from '@/lib/http-security-core'
import {
	getOperationAST,
	Kind,
	parse,
	type DocumentNode,
	type SelectionSetNode
} from 'graphql'

export const MINI_PROGRAM_CLIENT_HEADER = 'X-Letletme-Client'
export const MINI_PROGRAM_DEVICE_HEADER = 'X-Letletme-Device-Id'
export const MINI_PROGRAM_CLIENT = 'wechat-miniprogram'

const SAFE_DEVICE_ID = /^[A-Za-z0-9._:-]{8,128}$/

// Keep mixed documents in one deterministic workload-specific bucket. The
// generic/meta fallback must never override a selected expensive public root.
const CONSERVATIVE_WORKLOAD_ORDER = [
	'market',
	'fixtures',
	'player-stats',
	'gameweek',
	'interactive',
	'home',
	'public-other'
] as const satisfies readonly GraphQLWorkload[]

export type GraphQLProxyIngress =
	| {
			ok: true
			trafficClass: 'mini' | 'web_browser'
			workload: GraphQLWorkload
			headers: Record<string, string>
	  }
	| { ok: false; message: string }

function workloadForRootField(field: string): GraphQLWorkload {
	if (/^homePersonalDesk$/i.test(field)) return 'interactive'
	if (/^(liveContext|liveMatchday|liveScores)$/i.test(field)) {
		return 'gameweek'
	}
	if (/fixture/i.test(field)) return 'fixtures'
	if (/^events$/i.test(field)) return 'home'
	if (/^event$/i.test(field)) return 'gameweek'
	if (/market|ownership|transfer|price|playervalue|availability/i.test(field)) {
		return 'market'
	}
	if (
		/playerstats|playerdetail|playerstate|picker|^player$|^players$|team/i.test(
			field
		)
	) {
		return 'player-stats'
	}
	if (/gameweek|eventoverall|eventstats|dreamteam/i.test(field))
		return 'gameweek'
	if (
		/home|publicevents|currentandnextevents|coreeventcontext|currenteventinfo|notice/i.test(
			field
		)
	) {
		return 'home'
	}
	if (/myfpl|entry|live|tournament|competition|league|trend/i.test(field)) {
		return 'interactive'
	}
	return 'public-other'
}

function rootFieldsForOperation(
	document: DocumentNode,
	operationName: string | undefined
): string[] {
	const operation = getOperationAST(document, operationName)
	if (!operation) return []
	const fragments = new Map(
		document.definitions
			.filter(definition => definition.kind === Kind.FRAGMENT_DEFINITION)
			.map(fragment => [fragment.name.value, fragment])
	)
	const fields = new Set<string>()
	const visitedFragments = new Set<string>()
	const visit = (selectionSet: SelectionSetNode) => {
		for (const selection of selectionSet.selections) {
			if (selection.kind === Kind.FIELD) {
				fields.add(selection.name.value)
				continue
			}
			if (selection.kind === Kind.INLINE_FRAGMENT) {
				visit(selection.selectionSet)
				continue
			}
			if (visitedFragments.has(selection.name.value)) continue
			visitedFragments.add(selection.name.value)
			const fragment = fragments.get(selection.name.value)
			if (fragment) visit(fragment.selectionSet)
		}
	}
	visit(operation.selectionSet)
	return Array.from(fields)
}

/** Classify the selected schema fields, never the caller-controlled operation name. */
export function graphQLWorkloadForDocument(body: unknown): GraphQLWorkload {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return 'public-other'
	}
	const candidate = body as { query?: unknown; operationName?: unknown }
	if (typeof candidate.query !== 'string') return 'public-other'
	const operationName =
		typeof candidate.operationName === 'string'
			? candidate.operationName
			: undefined
	try {
		const workloads = new Set(
			rootFieldsForOperation(parse(candidate.query), operationName).map(
				workloadForRootField
			)
		)
		return (
			CONSERVATIVE_WORKLOAD_ORDER.find(workload => workloads.has(workload)) ??
			'public-other'
		)
	} catch {
		return 'public-other'
	}
}

export function validateMiniProgramDeviceId(
	value: string | null
): string | null {
	return value && SAFE_DEVICE_ID.test(value) ? value : null
}

export function buildGraphQLProxyIngress({
	headers,
	secret,
	workload
}: {
	headers: Headers
	secret: string
	workload: GraphQLWorkload
}): GraphQLProxyIngress {
	const client = headers.get(MINI_PROGRAM_CLIENT_HEADER)
	if (client !== null) {
		if (client !== MINI_PROGRAM_CLIENT) {
			return { ok: false, message: 'Unsupported GraphQL client header' }
		}
		const deviceId = validateMiniProgramDeviceId(
			headers.get(MINI_PROGRAM_DEVICE_HEADER)
		)
		if (!deviceId) {
			return { ok: false, message: 'Invalid Mini Program device ID' }
		}
		return {
			ok: true,
			trafficClass: 'mini',
			workload,
			headers: buildIngressContextHeadersV2(
				{
					trafficClass: 'mini',
					subject: buildOpaqueMiniDeviceSubject(deviceId, secret),
					abuseSubject: buildOpaqueAbuseSubject(headers, secret),
					workload
				},
				secret
			)
		}
	}
	// The only forwardable Authorization value is the Mini bearer contract.
	// Once such a credential is present, silently classifying the request as a
	// browser would bypass the Mini device/abuse buckets if the canonical client
	// headers were omitted. Require the complete Mini ingress contract instead.
	if (headers.get('authorization') !== null) {
		return {
			ok: false,
			message: 'Canonical Mini Program ingress headers are required'
		}
	}
	// A Mini Program request is identified only by the canonical client and
	// device headers above. An old Mini Program must not silently enter the web
	// bucket when it omits that contract; reject the recognizable old runtime so
	// it fails closed instead of receiving a misleading web response.
	if (/\bminiProgram\b/i.test(headers.get('user-agent') ?? '')) {
		return {
			ok: false,
			message: 'Canonical Mini Program ingress headers are required'
		}
	}
	const subject = buildOpaqueRateLimitSubject(headers, secret)
	return {
		ok: true,
		trafficClass: 'web_browser',
		workload,
		headers: buildIngressContextHeadersV2(
			{
				trafficClass: 'web_browser',
				subject,
				abuseSubject: null,
				workload
			},
			secret
		)
	}
}
