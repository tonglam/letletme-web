"use client";

import React, { useEffect, useState } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { PlayerList } from "@/components/live/PlayerList";
import { TeamStats } from "@/components/live/TeamStats";
import { TransferSection } from "@/components/live/TransferSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackToTournament } from "@/components/live/BackToTournament";
import { useSearchParams } from "next/navigation";
import { startingPlayers, benchPlayers, teamStats } from "@/lib/temp-data";

export default function TeamPointsClient({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");
  const teamId = params.id;
  
  // Mock additional team info
  const [teamInfo, setTeamInfo] = useState({
    ...teamStats,
    teamName: teamId === "1" ? "Arsenal Guangzhou FC" : 
              teamId === "2" ? "沉迷于搬砖不想披" : 
              teamId === "3" ? "世俱杯冠军阿森纳" : 
              teamId === "4" ? "Lord Bendtner" : 
              teamId === "5" ? "JackieHooooooo" : "let let red arrow↓↑↓",
    playerName: teamId === "1" ? "Gunners Fan" : 
               teamId === "2" ? "Brick Layer" : 
               teamId === "3" ? "Arsenal Champion" : 
               teamId === "4" ? "Nick B" : 
               teamId === "5" ? "Jackie H" : "tong",
    points: teamId === "1" ? 78 : 
            teamId === "2" ? 77 : 
            teamId === "3" ? 76 : 
            teamId === "4" ? 73 : 
            teamId === "5" ? 71 : 54
  });

  // For production, you would fetch the team data based on the ID
  useEffect(() => {
    console.log(`Fetching data for team ID: ${teamId}`);
    // This would be an API call in production
  }, [teamId]);

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {tournamentId && (
          <BackToTournament tournamentId={tournamentId} />
        )}
        
        <TeamStats stats={teamInfo} />

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