"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface BackToTournamentProps {
  tournamentId: string;
}

export function BackToTournament({ tournamentId }: BackToTournamentProps) {
  return (
    <div className="mb-4">
      <Link href={`/live/tournament/${tournamentId}`}>
        <Button variant="ghost" className="flex items-center gap-1 text-primary hover:text-primary/80">
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Tournament</span>
        </Button>
      </Link>
    </div>
  );
}