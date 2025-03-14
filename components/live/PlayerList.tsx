"use client";

import { Player } from "@/types/player";
import { PlayerRow } from "./PlayerRow";

interface PlayerListProps {
  players?: Player[];
  startingPlayers?: Player[];
  benchPlayers?: Player[];
}

export function PlayerList({ players, startingPlayers, benchPlayers }: PlayerListProps) {
  // Handle both direct players array and separate starting/bench arrays
  if (players) {
    return (
      <div className="divide-y">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>
    );
  }
  
  // Handle starting XI and bench case
  return (
    <div className="divide-y">
      <div>
        {startingPlayers && startingPlayers.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>
      
      {benchPlayers && benchPlayers.length > 0 && (
        <div className="bg-accent/20">
          <div className="p-4 text-sm font-medium text-muted-foreground">
            Substitutes
          </div>
          {benchPlayers.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}