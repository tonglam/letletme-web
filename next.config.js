/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig = {
	async redirects() {
		const legacyRoutes = [
			['/:locale/stats/gameweek', '/:locale/data/gameweek'],
			['/:locale/stats/team', '/:locale/me/team'],
			['/:locale/stats/tournament', '/:locale/me/tournament'],
			['/:locale/data/price-changes', '/:locale/data/market'],
			['/:locale/live/tournament', '/:locale/live/tournaments'],
			['/:locale/live/tournament/:id', '/:locale/live/tournaments/:id'],
			['/:locale/tournament/list', '/:locale/tournament/browse'],
			['/:locale/data/gameweek/gameweek', '/:locale/data/gameweek'],
		]
		return legacyRoutes.map(([source, destination]) => ({
			source,
			destination,
			permanent: true,
		}))
	},
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
		],
	},
	experimental: {},
}

module.exports = withNextIntl(nextConfig)
