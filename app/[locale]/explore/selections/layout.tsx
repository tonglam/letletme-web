import { AppToaster } from '@/components/feedback/AppToaster'
import { RouteIntlProvider } from '@/components/i18n/RouteIntlProvider'
import { ROUTE_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'
import type { ReactNode } from 'react'

export default function SelectionsLayout({
	children
}: {
	children: ReactNode
}) {
	return (
		<RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.selections}>
			{children}
			<AppToaster />
		</RouteIntlProvider>
	)
}
