import { Gamepad, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-primary/5 mt-16 border-t">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
          <div className="flex items-center gap-2">
            <Gamepad className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">LetLetMe</span>
          </div>
          
          <div className="relative group">
            <Button variant="outline" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span>WeChat Mini-Program</span>
            </Button>
            
            <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50 w-[160px]">
              <div className="relative w-[140px] h-[140px] mx-auto bg-white p-2 rounded border">
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                  <QrCode className="h-12 w-12 text-primary opacity-50" />
                </div>
              </div>
              <p className="text-xs text-center mt-2 text-muted-foreground">Scan to access our WeChat Mini-Program</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary">FPL</h3>
            <ul className="space-y-3">
              <li><Link href="/data/player-stats" className="text-muted-foreground hover:text-primary transition-colors">Player Stats</Link></li>
              <li><Link href="/data/team-stats" className="text-muted-foreground hover:text-primary transition-colors">Team Stats</Link></li>
              <li><Link href="/data/price-changes" className="text-muted-foreground hover:text-primary transition-colors">Price Changes</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary">Live</h3>
            <ul className="space-y-3">
              <li><Link href="/live/points" className="text-muted-foreground hover:text-primary transition-colors">Live Points</Link></li>
              <li><Link href="/live/tournament" className="text-muted-foreground hover:text-primary transition-colors">Tournaments</Link></li>
              <li><Link href="/live/matches" className="text-muted-foreground hover:text-primary transition-colors">Matches</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary">Stats</h3>
            <ul className="space-y-3">
              <li><Link href="/stats/gameweek" className="text-muted-foreground hover:text-primary transition-colors">Gameweek Stats</Link></li>
              <li><Link href="/stats/team" className="text-muted-foreground hover:text-primary transition-colors">Team Stats</Link></li>
              <li><Link href="/stats/tournament" className="text-muted-foreground hover:text-primary transition-colors">Tournament Stats</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 text-primary">Tournaments</h3>
            <ul className="space-y-3">
              <li><Link href="/tournament/list?mine=true" className="text-muted-foreground hover:text-primary transition-colors">My Tournaments</Link></li>
              <li><Link href="/tournament/create" className="text-muted-foreground hover:text-primary transition-colors">Create Tournament</Link></li>
              <li><Link href="/live/tournament" className="text-muted-foreground hover:text-primary transition-colors">Live Tournaments</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            © 2025 LetLetMe. All rights reserved.
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              English
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              中文
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}