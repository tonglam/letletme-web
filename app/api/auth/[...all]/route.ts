import { toNextJsHandler } from 'better-auth/next-js'

import { getAuth } from '@/lib/auth'

export function GET(...args: Parameters<ReturnType<typeof toNextJsHandler>['GET']>) {
	return toNextJsHandler(getAuth()).GET(...args)
}

export function POST(...args: Parameters<ReturnType<typeof toNextJsHandler>['POST']>) {
	return toNextJsHandler(getAuth()).POST(...args)
}
