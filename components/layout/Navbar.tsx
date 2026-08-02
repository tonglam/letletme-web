import { Gamepad } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { NavigationActions } from './NavigationActions'

export async function Navbar() {
  const t = await getTranslations('Navigation')

  return (
    <nav aria-label={t('primary')} className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Gamepad aria-hidden="true" className="size-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">LetLetMe</span>
        </Link>

        <div className="flex items-center gap-2">
          <NavigationActions />
        </div>
      </div>
    </nav>
  )
}
