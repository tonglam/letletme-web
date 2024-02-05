import LogoPic from '@/public/assets/images/logo.svg';
import Image from 'next/image';
import Link from 'next/link';

export const LogoIcon = () => {
	return (
		<section className="h-full w-1/2 self-center">
			<Link href="/">
				<Image
					className="cursor-pointer"
					alt="Logo"
					src={LogoPic}
					priority
				/>
			</Link>
		</section>
	);
};
