import { UserButton } from '@clerk/nextjs'

function ClerkButton() {
	return (
		<div className="h-screen">
			<UserButton afterSignOutUrl="/" />
		</div>
	)
}

export { ClerkButton }
