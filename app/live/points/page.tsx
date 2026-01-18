"use client";

import { GameweekSelector } from "@/components/data/GameweekSelector";
import RootLayout from "@/components/layout/RootLayout";
import { PlayerList } from "@/components/live/PlayerList";
import { TeamStats } from "@/components/live/TeamStats";
import { TransferSection } from "@/components/live/TransferSection";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { executeQuery } from "@/lib/graphql-client";
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from "@/lib/graphql/queries";
import { benchPlayers, startingPlayers, teamStats } from "@/lib/temp-data";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LivePoints() {
  const router = useRouter();
  const [currentGameweek, setCurrentGameweek] = useState<number | undefined>(undefined);
  const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentGameweek = async () => {
      try {
        setIsLoading(true);
        const response = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        
        const currentEvent = response.current?.[0];
        if (currentEvent) {
          setCurrentGameweek(currentEvent.id);
          setSelectedGameweek(currentEvent.id);
        }
      } catch (err) {
        console.error("Failed to fetch current gameweek:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentGameweek();
  }, []);

  if (isLoading || currentGameweek === undefined) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </RootLayout>
    );
  }

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