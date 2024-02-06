import Link from 'next/link'

export const Footer = () => {
	return (
		<footer className="footer footer-center p-4 text-content mt-8">
			<aside>
				<Link
					href="http://beian.miit.gov.cn"
					target="_blank"
				>
					<p>Copyright © 2023 - All right reserved by letletme.top</p>
				</Link>
			</aside>
		</footer>
	)
}
