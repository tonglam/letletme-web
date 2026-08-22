/** @type {import('next').NextConfig} */
const { execFileSync } = require('node:child_process')
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

function resolveReleaseSha() {
	const candidates =
		process.env.VERCEL === '1'
			? [
					process.env.VERCEL_GIT_COMMIT_SHA,
					process.env.LETLETME_RELEASE_SHA,
					process.env.GITHUB_SHA
			  ]
			: [
					process.env.LETLETME_RELEASE_SHA,
					process.env.VERCEL_GIT_COMMIT_SHA,
					process.env.GITHUB_SHA
			  ]
	for (const candidate of candidates) {
		if (/^[a-f0-9]{7,64}$/i.test(candidate ?? '')) {
			return candidate.toLowerCase()
		}
	}
	if (process.env.VERCEL === '1') {
		throw new Error(
			'Vercel builds require VERCEL_GIT_COMMIT_SHA or an explicit LETLETME_RELEASE_SHA'
		)
	}
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim()
	} catch {
		return 'development'
	}
}

function resolveDeploymentOrigin() {
	if (process.env.LETLETME_ORIGIN === 'tencent') return 'tencent'
	if (process.env.LETLETME_ORIGIN === 'vercel' || process.env.VERCEL === '1') {
		return 'vercel'
	}
	return 'local'
}

const releaseSha = resolveReleaseSha()
// Tencent's rolling self-hosted deployment needs a deterministic ID so that
// assets remain scoped to the release SHA. Vercel Git deployments already
// receive a unique platform deployment ID; supplying the same commit-derived
// custom ID on a redeploy makes Vercel reject the build as a duplicate.
const deploymentId = releaseSha.slice(0, 32)
const deploymentConfig =
	process.env.VERCEL === '1' ? {} : { deploymentId }
const deploymentOrigin = resolveDeploymentOrigin()
const isProduction = process.env.NODE_ENV === 'production'
const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"object-src 'none'",
	`script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com",
	"font-src 'self' data:",
	"connect-src 'self' https://*.supabase.co",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	...(isProduction ? ['upgrade-insecure-requests'] : [])
].join('; ')

const nextConfig = {
	output: 'standalone',
	poweredByHeader: false,
	allowedDevOrigins: ['127.0.0.1'],
	...deploymentConfig,
	generateBuildId: async () => releaseSha,
	env: {
		// Keep release attribution available inside server route handlers in
		// prebuilt Vercel deployments where Git system envs can be empty.
		LETLETME_RELEASE_SHA: releaseSha
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'X-Letletme-Origin', value: deploymentOrigin },
					{ key: 'X-Letletme-Release', value: releaseSha },
					...(isProduction
						? [
								{
									key: 'Strict-Transport-Security',
									value: 'max-age=31536000; includeSubDomains'
								}
							]
						: []),
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
					},
					{ key: 'Content-Security-Policy', value: contentSecurityPolicy }
				]
			}
		]
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '*.supabase.co',
				pathname: '/storage/v1/object/public/**'
			}
		]
	},
	// Keep the native image runtime outside the Turbopack bundle and trace the
	// Linux binaries that Vercel's Node.js function needs at runtime. Without
	// these explicit hints, a route that imports sharp can fail during module
	// initialization even before its auth guard runs.
	serverExternalPackages: ['sharp'],
	outputFileTracingIncludes: {
		'/api/profile/avatar': [
			'node_modules/@img/sharp-linux-x64/**/*',
			'node_modules/@img/sharp-libvips-linux-x64/**/*'
		]
	},
	// Vercel's Next 16 runtime auto-enables this for dynamic routes, but the
	// serverless renderer does not provide NEXT_DEPLOYMENT_ID to the Turbopack
	// preinit path. That produces ?dpl=undefined chunk URLs alongside the
	// correctly versioned scripts. Keep our deterministic deploymentId and use
	// the normal server-side asset token instead.
	experimental: {
		runtimeServerDeploymentId: false
	}
}

module.exports = withNextIntl(nextConfig)
