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
// Vercel limits custom skew-protection deployment IDs to 32 characters.
// Keep the complete commit SHA everywhere else and use its deterministic
// 32-character prefix only for deploymentId.
const deploymentId = releaseSha.slice(0, 32)
const deploymentOrigin = resolveDeploymentOrigin()

const nextConfig = {
	output: 'standalone',
	deploymentId,
	generateBuildId: async () => releaseSha,
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'X-Letletme-Origin', value: deploymentOrigin },
					{ key: 'X-Letletme-Release', value: releaseSha }
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
