import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import { ArrowLeft, SearchX } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
	return (
		<PageState
			icon={SearchX}
			title="Page not found"
			description="That route does not exist, or the resource is no longer available."
			actions={
				<Button asChild>
					<Link href="/">
						<ArrowLeft data-icon="inline-start" />
						Back to dashboard
					</Link>
				</Button>
			}
		/>
	)
}
