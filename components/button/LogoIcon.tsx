import LogoPic from '@/public/assets/logo.svg'
import Image from 'next/image'
import Link from 'next/link'

function LogoIcon() {
	return (
		<>
			<Link href="/">
				<Image
					className="cursor-pointer"
					alt="Logo"
					src={LogoPic}
					priority
				/>
			</Link>
		</>
	)
}

export { LogoIcon }
