"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import Image from "next/image";

interface Match {
  date: string;
  dateObj: Date;
  matches: {
    homeTeam: string;
    homeTeamShort: string;
    awayTeam: string;
    awayTeamShort: string;
    time: string;
  }[];
}

const matches: Match[] = [
  {
    date: "Wednesday 15 January 2025",
    dateObj: new Date("2025-01-15"),
    matches: [
      {
        homeTeam: "Brentford",
        homeTeamShort: "BRE",
        awayTeam: "Man City",
        awayTeamShort: "MCI",
        time: "03:30"
      },
      {
        homeTeam: "Chelsea",
        homeTeamShort: "CHE",
        awayTeam: "Bournemouth",
        awayTeamShort: "BOU",
        time: "03:30"
      },
      {
        homeTeam: "West Ham",
        homeTeamShort: "WHU",
        awayTeam: "Fulham",
        awayTeamShort: "FUL",
        time: "03:30"
      },
      {
        homeTeam: "Nott'm Forest",
        homeTeamShort: "NFO",
        awayTeam: "Liverpool",
        awayTeamShort: "LIV",
        time: "04:00"
      }
    ]
  },
  {
    date: "Thursday 16 January 2025",
    dateObj: new Date("2025-01-16"),
    matches: [
      {
        homeTeam: "Arsenal",
        homeTeamShort: "ARS",
        awayTeam: "Crystal Palace",
        awayTeamShort: "CRY",
        time: "03:30"
      },
      {
        homeTeam: "Brighton",
        homeTeamShort: "BHA",
        awayTeam: "Wolves",
        awayTeamShort: "WOL",
        time: "03:30"
      }
    ]
  },
  {
    date: "Friday 17 January 2025",
    dateObj: new Date("2025-01-17"),
    matches: [
      {
        homeTeam: "Manchester United",
        homeTeamShort: "MUN",
        awayTeam: "Tottenham",
        awayTeamShort: "TOT",
        time: "03:30"
      },
      {
        homeTeam: "Aston Villa",
        homeTeamShort: "AVL",
        awayTeam: "Newcastle",
        awayTeamShort: "NEW",
        time: "04:00"
      },
      {
        homeTeam: "Sheffield United",
        homeTeamShort: "SHU",
        awayTeam: "Everton",
        awayTeamShort: "EVE",
        time: "04:15"
      },
      {
        homeTeam: "Luton Town",
        homeTeamShort: "LUT",
        awayTeam: "Burnley",
        awayTeamShort: "BUR",
        time: "04:30"
      }
    ]
  }
];

function MatchList({ matches }: { matches: Match["matches"] }) {
  return (
    <div className="space-y-4 md:space-y-6">
      {matches.map((match, matchIndex) => (
        <div key={matchIndex} className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center bg-accent/50 rounded-lg p-4 hover:bg-accent/70 transition-colors">
            <div className="grid grid-cols-3 items-center flex-1 gap-4">
              <div className="flex items-center justify-end space-x-3">
                <div className="relative w-8 h-8 md:w-10 md:h-10">
                  <Image
                    src={`/team-logos/${match.homeTeamShort.toLowerCase()}.png`}
                    alt={match.homeTeam}
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="font-semibold text-sm md:text-base text-right">
                  <span className="hidden md:inline">{match.homeTeam}</span>
                  <span className="md:hidden">{match.homeTeamShort}</span>
                </span>
              </div>
              
              <div className="px-4 py-2 bg-background rounded-lg font-mono text-sm md:text-base font-semibold text-center mx-auto">
                {match.time}
              </div>
              
              <div className="flex items-center justify-start space-x-3">
                <span className="font-semibold text-sm md:text-base">
                  <span className="hidden md:inline">{match.awayTeam}</span>
                  <span className="md:hidden">{match.awayTeamShort}</span>
                </span>
                <div className="relative w-8 h-8 md:w-10 md:h-10">
                  <Image
                    src={`/team-logos/${match.awayTeamShort.toLowerCase()}.png`}
                    alt={match.awayTeam}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
          {matchIndex < matches.length - 1 && (
            <Separator className="my-4 md:my-6" />
          )}
        </div>
      ))}
    </div>
  );
}

export function MatchesSection() {
  return (
    <div className="flex-grow mb-8">
      <Card className="p-4 md:p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
          Upcoming Matches
        </h2>
        
        {/* Mobile view with tabs */}
        <div className="md:hidden">
          <Tabs defaultValue={matches[0].date} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              {matches.map((matchDay) => (
                <TabsTrigger key={matchDay.date} value={matchDay.date} className="text-xs">
                  {format(matchDay.dateObj, "EEE dd/MM")}
                </TabsTrigger>
              ))}
            </TabsList>
            {matches.map((matchDay) => (
              <TabsContent key={matchDay.date} value={matchDay.date}>
                <MatchList matches={matchDay.matches} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
        
        {/* Desktop view with all days */}
        <div className="hidden md:block">
          {matches.map((matchDay, dayIndex) => (
            <div key={matchDay.date} className="max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold text-muted-foreground mb-6 mt-8 text-center">
                {format(matchDay.dateObj, "EEEE dd MMMM yyyy")}
              </h3>
              <MatchList matches={matchDay.matches} />
              {dayIndex < matches.length - 1 && (
                <Separator className="mt-8" />
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t text-center max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground">All times are shown in your local timezone</p>
        </div>
      </Card>
    </div>
  );
}