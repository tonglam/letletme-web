/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
		],
	},
	experimental: {},
}

module.exports = nextConfig
