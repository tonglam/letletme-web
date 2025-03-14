"use client";

import { Card } from "@/components/ui/card";
import { TransferList } from "./TransferList";

interface Transfer {
  position: string;
  player: string;
  club: string;
  transfers: number;
}

const transfersIn: Transfer[] = [
  { position: "MID", player: "Gordon", club: "NEW", transfers: 347621 },
  { position: "DEF", player: "Hall", club: "NEW", transfers: 254888 },
  { position: "MID", player: "Mbeumo", club: "BRE", transfers: 251941 },
  { position: "FWD", player: "Isak", club: "NEW", transfers: 236148 },
  { position: "MID", player: "Sávio", club: "MCI", transfers: 211722 }
];

const transfersOut: Transfer[] = [
  { position: "FWD", player: "N.Jackson", club: "CHE", transfers: 262730 },
  { position: "MID", player: "Maddison", club: "TOT", transfers: 180737 },
  { position: "MID", player: "Luis Diaz", club: "LIV", transfers: 173046 },
  { position: "FWD", player: "Cunha", club: "WOL", transfers: 121258 },
  { position: "MID", player: "Enzo", club: "CHE", transfers: 118093 }
];

export function GameweekStatsSection() {
  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
      <div className="space-y-6">
        <TransferList
          title="Top Transfers In"
          transfers={transfersIn}
          type="in"
        />
        <TransferList
          title="Top Transfers Out"
          transfers={transfersOut}
          type="out"
        />
      </div>
    </Card>
  );
}