import { UserButton } from '@clerk/nextjs'

function EntryButton() {
	return (
		<>
			<UserButton afterSignOutUrl="/" />
		</>
	)
}

export { EntryButton }
