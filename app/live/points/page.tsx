"use client";

import React from "react";
import { useRouter } from "next/navigation";
import RootLayout from "@/components/layout/RootLayout";
import { PlayerList } from "@/components/live/PlayerList";
import { TeamStats } from "@/components/live/TeamStats";
import { TransferSection } from "@/components/live/TransferSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { startingPlayers, benchPlayers, teamStats } from "@/lib/temp-data";
import { useEffect, useState } from "react";

export default function LivePoints() {
  const router = useRouter();
  const currentGameweek = 21; // Current gameweek
  const [selectedGameweek, setSelectedGameweek] = useState(currentGameweek);
  
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <GameweekSelector 
            onGameweekChange={setSelectedGameweek}
            currentGameweek={currentGameweek}
          />
        </div>

        <TeamStats stats={teamStats} />

        <Tabs defaultValue="list" className="w-full">
          <div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
            <TabsList className="w-full grid grid-cols-2 gap-2 sm:gap-4">
              <TabsTrigger value="list" className="w-full">List View</TabsTrigger>
              <TabsTrigger value="pitch" className="w-full">Pitch View</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list">
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <PlayerList 
                startingPlayers={startingPlayers}
                benchPlayers={benchPlayers}
              />
            </div>
          </TabsContent>

          <TabsContent value="pitch">
            <div className="bg-card rounded-lg shadow-md p-8">
              <div className="text-center text-muted-foreground">
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p>The pitch view feature is currently under development.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-8">
          <TransferSection />
        </div>
      </div>
    </RootLayout>
  );
}