'use client'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useSession } from '@/lib/auth-client'
import { DesktopNav } from './DesktopNav'
import { MobileNav } from './MobileNav'

export function NavigationActions() {
	const { data: session } = useSession()
	const user = session?.user ?? null

	return (
		<>
			<DesktopNav user={user} />
			<ThemeToggle />
			<MobileNav user={user} />
		</>
	)
}
