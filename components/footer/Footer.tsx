import Link from 'next/link'

function Footer() {
	return (
		<footer className="footer footer-center p-4 text-content mt-8">
			<aside>
				<Link
					className="flex space-x-1"
					href="http://beian.miit.gov.cn"
					target="_blank"
				>
					<p>Copyright © 2024 - All right reserved by</p>
					<p className="hover:underline">letletme.top</p>
				</Link>
			</aside>
		</footer>
	)
}

export { Footer }
