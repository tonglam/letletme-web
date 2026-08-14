import 'server-only'

import {
	GLOBAL_CLIENT_NAMESPACES,
	type ClientMessageNamespace
} from '@/i18n/client-namespaces'
import { selectMessages } from '@/i18n/message-selection'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { ReactNode } from 'react'

export async function RouteIntlProvider({
	children,
	namespaces
}: {
	children: ReactNode
	namespaces: readonly ClientMessageNamespace[]
}) {
	const messages = (await getMessages()) as IntlMessages
	// next-intl treats messages as an atomic provider prop. A nested provider
	// therefore has to carry the root namespaces forward explicitly.
	const selected = selectMessages(messages, [
		...GLOBAL_CLIENT_NAMESPACES,
		...namespaces
	])
	return (
		<NextIntlClientProvider messages={selected as IntlMessages}>
			{children}
		</NextIntlClientProvider>
	)
}
