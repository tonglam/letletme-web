import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-emerald-500 footer footer-center p-4 text-content">
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
