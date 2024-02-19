import { UserButton } from '@clerk/nextjs'

export const EntryButton = () => {
	return (
		<div>
			<UserButton afterSignOutUrl="/" />
		</div>
	)
}
