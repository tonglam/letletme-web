/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig = {
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
		],
	},
	experimental: {},
}

module.exports = withNextIntl(nextConfig)
