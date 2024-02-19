import { UserButton } from '@clerk/nextjs'

export const ClerkButton = () => {
	return (
		<div className="h-screen">
			<UserButton afterSignOutUrl="/" />
		</div>
	)
}
