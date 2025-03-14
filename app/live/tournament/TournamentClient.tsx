"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RootLayout from "@/components/layout/RootLayout";
import { TournamentHeader } from "@/components/tournament/TournamentHeader";
import { SearchHeader } from "@/components/tournament/SearchHeader";
import { TournamentTable } from "@/components/tournament/TournamentTable";
import { TournamentSelector } from "@/components/tournament/TournamentSelector";
import { Tournament } from "@/types/tournament";

const DEFAULT_TOURNAMENT_ID = "t1";

interface TournamentClientProps {
  tournaments: Tournament[];
}

export default function TournamentClient({ tournaments }: TournamentClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tournamentIdFromUrl = searchParams.get("tournamentId") || DEFAULT_TOURNAMENT_ID;

  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Find the current tournament based on the selected ID
  const currentTournament = useMemo(() => {
    const tournament = tournaments.find(t => t.id === tournamentIdFromUrl);
    if (!tournament) {
      router.replace(`/live/tournament?tournamentId=${DEFAULT_TOURNAMENT_ID}`);
      return tournaments[0];
    }
    return tournament;
  }, [tournamentIdFromUrl, tournaments, router]);

  // Handle tournament change
  const handleTournamentChange = (tournamentId: string) => {
    router.replace(`/live/tournament?tournamentId=${tournamentId}`);
    setSearchQuery("");
  };
  
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <TournamentSelector
          tournaments={tournaments}
          currentTournamentId={tournamentIdFromUrl}
          onTournamentChange={handleTournamentChange}
        />
        
        <TournamentHeader 
          name={currentTournament.name}
          gameweek={currentTournament.gameweek}
          averagePoints={currentTournament.averagePoints}
          highestPoints={currentTournament.highestPoints}
          totalEntries={currentTournament.totalEntries}
        />
        
        <SearchHeader 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        
        <TournamentTable 
          entries={currentTournament.entries}
          searchQuery={searchQuery}
          tournamentId={tournamentIdFromUrl}
        />
      </div>
    </RootLayout>
  );
}