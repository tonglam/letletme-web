import { tournaments } from "@/lib/tournament-data";

export function generateStaticParams() {
  // Pre-generate routes for all tournament IDs from the tournament data
  return tournaments.map(tournament => ({
    id: tournament.id
  }));
}