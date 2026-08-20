import {
	buildIngressContextHeaders,
	buildIngressContextHeadersV2,
	buildOpaqueAbuseSubject,
	buildOpaqueMiniDeviceSubject,
	buildOpaqueRateLimitSubject,
	type GraphQLWorkload
} from '@/lib/http-security-core'

export const MINI_PROGRAM_CLIENT_HEADER = 'X-Letletme-Client'
export const MINI_PROGRAM_DEVICE_HEADER = 'X-Letletme-Device-Id'
export const MINI_PROGRAM_CLIENT = 'wechat-miniprogram'

const SAFE_DEVICE_ID = /^[A-Za-z0-9._:-]{8,128}$/

export type GraphQLProxyIngress =
	| {
			ok: true
			trafficClass: 'mini' | 'web_browser' | 'legacy'
			workload: GraphQLWorkload
			headers: Record<string, string>
	  }
	| { ok: false; message: string }

export function graphQLWorkloadForOperation(
	operationName: string | null | undefined
): GraphQLWorkload {
	const name = operationName ?? ''
	if (/fixture/i.test(name)) return 'fixtures'
	if (/market|ownership|transfer|price/i.test(name)) return 'market'
	if (/playerstats|playerdetail|playerstate|picker/i.test(name)) {
		return 'player-stats'
	}
	if (/gameweek|eventoverall|eventstats/i.test(name)) return 'gameweek'
	if (/home|publicevents|currentandnextevents|coreeventcontext/i.test(name)) {
		return 'home'
	}
	if (/myfpl|entry|live|tournament|competition/i.test(name)) {
		return 'interactive'
	}
	return 'public-other'
}

export function validateMiniProgramDeviceId(value: string | null): string | null {
	return value && SAFE_DEVICE_ID.test(value) ? value : null
}

function looksLikeLegacyMiniProgram(headers: Headers): boolean {
	return /micromessenger|miniProgram/i.test(headers.get('user-agent') ?? '')
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
	const subject = buildOpaqueRateLimitSubject(headers, secret)
	if (looksLikeLegacyMiniProgram(headers)) {
		return {
			ok: true,
			trafficClass: 'legacy',
			workload: 'public-other',
			headers: buildIngressContextHeaders(subject, secret)
		}
	}
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
