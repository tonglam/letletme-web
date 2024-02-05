import { Button } from '@/components/ui/button';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

export const GithubIcon = () => {
	return (
		<section className="cursor-pointer self-center">
			<Button
				variant="ghost"
				size="icon"
			>
				<Link
					href="https://github.com/tonglam/letletme-web"
					target="_blank"
				>
					<GitHubLogoIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				</Link>
			</Button>
		</section>
	);
};
