import { RouteIntlProvider } from '@/components/i18n/RouteIntlProvider'
import { AppToaster } from '@/components/feedback/AppToaster'
import { ROUTE_CLIENT_NAMESPACES } from '@/i18n/client-namespaces'
import type { ReactNode } from 'react'

export default function ProfileLayout({ children }: { children: ReactNode }) {
	return (
		<RouteIntlProvider namespaces={ROUTE_CLIENT_NAMESPACES.profile}>
			{children}
			<AppToaster />
		</RouteIntlProvider>
	)
}
