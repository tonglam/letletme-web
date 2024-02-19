import LogoPic from '@/public/assets/logo.svg'
import Image from 'next/image'
import Link from 'next/link'

export const LogoIcon = () => {
	return (
		<section>
			<Link href="/">
				<Image
					className="cursor-pointer"
					alt="Logo"
					src={LogoPic}
					priority
				/>
			</Link>
		</section>
	)
}