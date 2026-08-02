import { Badge } from '@/components/ui/badge'
import { Gamepad, QrCode } from 'lucide-react'
import Link from 'next/link'

const footerGroups = [
  {
    label: 'FPL data',
    links: [
      { label: 'Player stats', href: '/data/player-stats' },
      { label: 'Price changes', href: '/data/price-changes' },
    ],
  },
  {
    label: 'Live',
    links: [
      { label: 'Live points', href: '/live/points' },
      { label: 'Tournaments', href: '/live/tournament' },
      { label: 'Matches', href: '/live/matches' },
    ],
  },
  {
    label: 'Analysis',
    links: [
      { label: 'Gameweek stats', href: '/stats/gameweek' },
      { label: 'Team stats', href: '/stats/team' },
      { label: 'Tournament stats', href: '/stats/tournament' },
    ],
  },
  {
    label: 'Tournaments',
    links: [
      { label: 'My tournaments', href: '/tournament/list?mine=true' },
      { label: 'Create tournament', href: '/tournament/create' },
      { label: 'Live standings', href: '/live/tournament' },
    ],
  },
] as const

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Gamepad aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">LetLetMe</p>
              <p className="text-sm text-muted-foreground">Sharper FPL decisions, without the noise.</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit gap-2 py-1.5">
            <QrCode aria-hidden="true" className="size-4" />
            WeChat Mini Program
          </Badge>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerGroups.map(group => (
            <div key={group.label}>
              <p className="mb-3 text-sm font-semibold text-foreground">{group.label}</p>
              <ul className="flex flex-col gap-2.5">
                {group.links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} LetLetMe. All rights reserved.</p>
          <p>Built for Fantasy Premier League managers.</p>
        </div>
      </div>
    </footer>
  )
}
