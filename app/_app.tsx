import { getLogger } from '@/lib/logger'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
	const logger = getLogger('app')

	logger.error('a error message from _app')
	logger.debug('a debug message from _app')
	logger.info('a info message from _app')

	return <Component {...pageProps} />
}
