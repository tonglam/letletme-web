import { Button } from '@/components/ui/button'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import Link from 'next/link'

function Github() {
	return (
		<section>
			<Button
				variant="ghost"
				size="icon"
			>
				<Link
					href="https://github.com/tonglam/letletme-web"
					target="_blank"
				>
					<GitHubLogoIcon className="h-[1.5rem] w-[1.5rem] transition-all" />
				</Link>
			</Button>
		</section>
	)
}

export default Github
