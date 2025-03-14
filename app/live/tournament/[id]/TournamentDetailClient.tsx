"use client";

import { useState } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { TournamentHeader } from "@/components/tournament/TournamentHeader";
import { SearchHeader } from "@/components/tournament/SearchHeader";
import { TournamentTable } from "@/components/tournament/TournamentTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tournaments } from "@/lib/tournament-data";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Users, BarChart2 } from "lucide-react";
import Link from "next/link";

export default function TournamentDetailClient({ params }: { params: { id: string } }) {
  const tournamentId = params.id;
  const [searchQuery, setSearchQuery] = useState("");
  
  // Find the tournament by ID
  const tournament = tournaments.find(t => t.id === tournamentId) || tournaments[0];
  
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Link href="/live/tournament">
          <Button variant="ghost" className="flex items-center gap-1 text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Tournaments</span>
          </Button>
        </Link>
        
        <TournamentHeader 
          name={tournament.name}
          gameweek={tournament.gameweek}
          averagePoints={tournament.averagePoints}
          highestPoints={tournament.highestPoints}
          totalEntries={tournament.totalEntries}
        />
        
        <Tabs defaultValue="standings" className="mb-6">
          <Card className="p-4 mb-6">
            <TabsList className="w-full grid grid-cols-3 gap-2">
              <TabsTrigger value="standings">Standings</TabsTrigger>
              <TabsTrigger value="stats">Tournament Stats</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
          </Card>
          
          <TabsContent value="standings">
            <SearchHeader 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
            
            <TournamentTable 
              entries={tournament.entries}
              searchQuery={searchQuery}
              tournamentId={tournamentId}
            />
          </TabsContent>
          
          <TabsContent value="stats">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Tournament Statistics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5 text-emerald-500" />
                      Top Performers
                    </h3>
                    <div className="space-y-2">
                      {tournament.entries.slice(0, 3).map((entry, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-accent/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{i + 1}.</span>
                            <span className="font-medium">{entry.teamName}</span>
                          </div>
                          <span className="font-bold">{entry.totalPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Users className="mr-2 h-5 w-5 text-blue-500" />
                      Participant Count
                    </h3>
                    <div className="text-3xl font-bold">{tournament.totalEntries}</div>
                    <p className="text-sm text-muted-foreground">Total teams participating</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <TrendingDown className="mr-2 h-5 w-5 text-rose-500" />
                      Bottom Performers
                    </h3>
                    <div className="space-y-2">
                      {tournament.entries.slice(-3).map((entry, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-accent/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{tournament.entries.length - 2 + i}.</span>
                            <span className="font-medium">{entry.teamName}</span>
                          </div>
                          <span className="font-bold">{entry.totalPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Calendar className="mr-2 h-5 w-5 text-purple-500" />
                      Tournament Period
                    </h3>
                    <div className="text-xl font-bold">Gameweek {tournament.gameweek}</div>
                    <p className="text-sm text-muted-foreground">Current gameweek</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <BarChart2 className="mr-2 h-5 w-5 text-yellow-500" />
                  Points Distribution
                </h3>
                <div className="bg-accent/30 p-6 rounded-lg flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Points distribution chart coming soon</p>
                </div>
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="rules">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Tournament Rules</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Scoring System</h3>
                  <p className="text-muted-foreground mb-2">
                    The tournament uses the standard Fantasy Premier League points system for all participants.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Players receive points based on their FPL performance in each gameweek</li>
                    <li>Captain points count double</li>
                    <li>All chips and transfers are allowed as per FPL rules</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Tournament Format</h3>
                  <p className="text-muted-foreground mb-2">
                    This tournament follows a league format where all teams compete against each other.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Teams are ranked by total FPL points accumulated</li>
                    <li>Tiebreakers are resolved by overall FPL rank</li>
                    <li>The tournament runs from GW{tournament.gameweek-5} to GW{tournament.gameweek+10}</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Prizes and Recognition</h3>
                  <p className="text-muted-foreground mb-2">
                    Winners receive recognition and bragging rights among participants.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>1st Place: Tournament Champion Trophy (digital)</li>
                    <li>2nd Place: Silver Medal Badge</li>
                    <li>3rd Place: Bronze Medal Badge</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}