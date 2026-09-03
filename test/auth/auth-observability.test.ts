import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
	authDeviceCookieValueFromHeader,
	hmacAuthReference,
	normalizeClientEnvironment,
	normalizeMiniProgramLoginContext,
	normalizePhaseTimings,
	normalizeRequestId,
	resolveAuthRelease
} from '../../lib/auth-observability-core'
import { safeAuthLogDiagnostics } from '../../lib/auth-safe-log'

test('auth observability references are purpose-separated and never return raw identifiers', () => {
	const secret = 'a'.repeat(32)
	const email = 'user@example.test'
	const emailReference = hmacAuthReference(email, 'email', secret)
	const deviceReference = hmacAuthReference(email, 'device', secret)

	assert.ok(emailReference?.startsWith('h1:email:'))
	assert.ok(deviceReference?.startsWith('h1:device:'))
	assert.notEqual(emailReference, deviceReference)
	assert.equal(emailReference?.includes(email), false)
	assert.equal(hmacAuthReference(email, 'email', 'short'), undefined)
})

test('mini login context and browser metadata are coarse and bounded', () => {
	const context = normalizeMiniProgramLoginContext({
		schemaVersion: 1,
		trigger: 'cold_start_missing',
		platform: 'ios',
		deviceClass: 'phone',
		osFamily: 'ios',
		osMajor: '17.5',
		wechatMajor: '8.0.50',
		sdkVersion: '3.17.1',
		miniProgramVersion: '2026.08.25',
		envVersion: 'trial',
		pageRoute: '/pages/account/index',
		encryptedStorageSupported: true,
		credentialState: 'encrypted',
		brand: 'must-not-be-accepted',
		model: 'must-not-be-accepted'
	})

	assert.deepEqual(context, {
		schemaVersion: 1,
		trigger: 'cold_start_missing',
		platform: 'ios',
		deviceClass: 'phone',
		osFamily: 'ios',
		osMajor: '17',
		wechatMajor: '8',
		sdkVersion: '3.17.1',
		miniProgramVersion: '2026.08.25',
		envVersion: 'trial',
		pageRoute: 'pages/account/index',
		encryptedStorageSupported: true,
		credentialState: 'encrypted'
	})
	assert.equal(JSON.stringify(context).includes('must-not-be-accepted'), false)
	assert.deepEqual(normalizeClientEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1'), {
		browserFamily: 'safari',
		browserMajor: '17',
		osFamily: 'ios',
		osMajor: '17',
		deviceClass: 'phone'
	})
	assert.equal(
		normalizeClientEnvironment(
			'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50'
		).browserFamily,
		'wechat'
	)
	assert.equal(
		normalizeClientEnvironment(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0'
		).browserFamily,
		'opera'
	)
	assert.equal(normalizeRequestId('bad request'), undefined)
	assert.deepEqual(normalizePhaseTimings({ login: 12.345, bad: -1, huge: 99_999_999 }), { login: 12.35 })
})

test('device cookie parsing accepts only the first-party random value', () => {
	assert.equal(
		authDeviceCookieValueFromHeader('other=1; letletme.auth_device=device-test-value-000000; x=2'),
		'device-test-value-000000'
	)
	assert.equal(
		authDeviceCookieValueFromHeader('letletme.auth_device=contains%20space'),
		undefined
	)
})

test('safe auth diagnostics exclude messages, SQL, credentials, and headers', () => {
	const serialized = JSON.stringify(
		safeAuthLogDiagnostics([
			new Error('SELECT * FROM bauth.session WHERE token = secret-token'),
			{
				message: 'user@example.test',
				stack: 'Error: SQL at /secret/ip',
				cookie: 'letletme.auth_device=raw-cookie-value',
				token: 'raw-token',
				openid: 'raw-openid',
				ip: '203.0.113.10',
				userAgent: 'raw user agent'
			}
		])
	)
	for (const secret of [
		'SELECT * FROM',
		'user@example.test',
		'raw-cookie-value',
		'raw-token',
		'raw-openid',
		'203.0.113.10',
		'raw user agent'
	]) {
		assert.equal(serialized.includes(secret), false, secret)
	}
})

test('auth release prefers the self-hosted release over the Vercel fallback', () => {
	const names = ['LETLETME_RELEASE_SHA', 'VERCEL_GIT_COMMIT_SHA'] as const
	const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
	process.env.LETLETME_RELEASE_SHA = 'selfhosted123456789'
	process.env.VERCEL_GIT_COMMIT_SHA = 'stale-vercel-release-987654321'
	try {
		assert.equal(resolveAuthRelease(), 'selfhosted12')
	} finally {
		for (const name of names) {
			if (previous[name] === undefined) delete process.env[name]
			else process.env[name] = previous[name]
		}
	}
})

test('logout telemetry has an IP rate-limit boundary and self-hosted cleanup starts on install', () => {
	const miniLogout = readFileSync('app/api/miniprogram/session/route.ts', 'utf8')
	const webLogout = readFileSync('app/api/session/logout/route.ts', 'utf8')
	const authCatchAll = readFileSync('app/api/auth/[...all]/route.ts', 'utf8')
	const observability = readFileSync('lib/auth-observability.ts', 'utf8')
	const installHost = readFileSync('ops/tencent/scripts/install-host.sh', 'utf8')

	assert.match(miniLogout, /enforceLogoutRateLimit\(\{ request, channel: 'mini' \}\)/)
	assert.match(webLogout, /enforceLogoutRateLimit\(\{ request, channel: 'web' \}\)/)
	assert.equal(webLogout.includes('isTrustedSameSiteRequest'), false)
	assert.ok(
		webLogout.indexOf('enforceLogoutRateLimit') <
			webLogout.indexOf('withAuthDeviceCookie(request, await logout')
	)
	assert.match(authCatchAll, /BETTER_AUTH_GET_RATE_LIMIT = 30/)
	assert.match(authCatchAll, /scope: 'better-auth-get-ip'/)
	assert.match(observability, /recordAuthRequestOutcome\(\n\s+503,/)
	assert.match(installHost, /systemctl enable --now letletme-auth-event-cleanup\.timer/)
})

test('keeps the OAuth start path independent of the database limiter', () => {
	const authCatchAll = readFileSync('app/api/auth/[...all]/route.ts', 'utf8')
	const post = authCatchAll.slice(authCatchAll.indexOf('export async function POST'))
	const oauthStartGate = post.indexOf("operation !== 'google-login-start'")
	const databaseLimiter = post.indexOf("scope: 'better-auth-ip'")

	assert.ok(oauthStartGate >= 0)
	assert.ok(databaseLimiter > oauthStartGate)
	assert.match(post, /const operation = authOperation\(request\)/)
})
