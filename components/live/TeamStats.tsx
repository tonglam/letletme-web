"use client";

import React from "react";
import { Separator } from "@/components/ui/separator";
import { Trophy, Users2, Clock, Zap } from "lucide-react";

interface TeamStatsProps {
  stats: {
    teamName: string;
    playerName: string;
    points: number;
    totalPoints: number;
    playersPlayed: number;
    playersToPlay: number;
    chips: {
      bench: boolean;
      triple: boolean;
      wildcard: boolean;
    };
  };
}

export function TeamStats({ stats }: TeamStatsProps) {
  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">{stats.teamName}</h2>
        <p className="text-muted-foreground mb-8">{stats.playerName}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Live Points</span>
            </div>
            <div className="text-2xl font-bold">{stats.points}</div>
          </div>
          
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Points</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalPoints}</div>
          </div>
          
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">To Play</span>
            </div>
            <div className="text-2xl font-bold">{stats.playersToPlay}</div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Users2 className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Played</span>
            </div>
            <div className="text-2xl font-bold">{stats.playersPlayed}</div>
          </div>
        </div>
      
        <Separator className="my-6" />
      
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Active Chips</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.chips).some(([_, active]) => active) ? (
              Object.entries(stats.chips).map(([chip, active]) => 
                active && (
                  <span key={chip} className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    {chip.toUpperCase()}
                  </span>
                )
              )
            ) : (
              <span className="text-sm text-muted-foreground">No active chips</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}