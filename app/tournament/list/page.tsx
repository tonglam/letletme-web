"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Search, 
  Calendar, 
  Users,
  Plus,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

// Mock data for tournaments
const mockTournaments = [
  {
    id: "t1",
    name: "Premier League Fan Cup",
    managerId: "12",
    managerName: "tong",
    participantCount: 12,
    groupFormat: "points",
    knockoutFormat: "single",
    startGameweek: "GW22",
    endGameweek: "GW38",
    created: "2024-01-15",
    lastUpdated: "2024-04-10",
    isActive: true,
    progress: 65 // percent complete
  },
  {
    id: "t2",
    name: "Champions League Fantasy",
    managerId: "12",
    managerName: "tong",
    participantCount: 8,
    groupFormat: "points",
    knockoutFormat: "double",
    startGameweek: "GW25",
    endGameweek: "GW35",
    created: "2024-02-05",
    lastUpdated: "2024-04-08",
    isActive: true,
    progress: 40
  },
  {
    id: "t3",
    name: "FPL Content Creators Cup",
    managerId: "15",
    managerName: "Alex",
    participantCount: 16,
    groupFormat: "headToHead",
    knockoutFormat: "single",
    startGameweek: "GW20",
    endGameweek: "GW30",
    created: "2024-01-02",
    lastUpdated: "2024-03-28",
    isActive: false,
    progress: 100
  },
  {
    id: "t4",
    name: "Mini-League Challenge",
    managerId: "12",
    managerName: "tong",
    participantCount: 4,
    groupFormat: "none",
    knockoutFormat: "single",
    startGameweek: "GW30",
    endGameweek: "GW34",
    created: "2024-03-25",
    lastUpdated: "2024-04-01",
    isActive: true,
    progress: 20
  },
  {
    id: "t5",
    name: "Work Colleagues Cup",
    managerId: "18",
    managerName: "Sarah",
    participantCount: 6,
    groupFormat: "points",
    knockoutFormat: "none",
    startGameweek: "GW15",
    endGameweek: "GW38",
    created: "2023-12-10",
    lastUpdated: "2024-04-11",
    isActive: true,
    progress: 72
  }
];

export default function TournamentList() {
  const searchParams = useSearchParams();
  const mineParam = searchParams.get("mine");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(mineParam === "true");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  // Initialize showOnlyMine from URL parameter
  useEffect(() => {
    if (mineParam === "true") {
      setShowOnlyMine(true);
    }
  }, [mineParam]);

  // Filter tournaments based on search and filters
  const filteredTournaments = mockTournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tournament.managerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMine = showOnlyMine ? tournament.managerId === "12" : true;
    const matchesActive = showOnlyActive ? tournament.isActive : true;
    
    return matchesSearch && matchesMine && matchesActive;
  });

  return (
    <RootLayout>
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Tournaments</h1>
          </div>
          
          <Link href="/tournament/create">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Tournament
            </Button>
          </Link>
        </div>
        
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showOnlyMine ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyMine(!showOnlyMine)}
                className="flex items-center gap-2"
              >
                My Tournaments
              </Button>
              
              <Button
                variant={showOnlyActive ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyActive(!showOnlyActive)}
                className="flex items-center gap-2"
              >
                Active Only
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">More Filters</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <div className="flex items-center w-full justify-between">
                      <span>Group Stage Only</span>
                      <input type="checkbox" className="h-4 w-4" />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex items-center w-full justify-between">
                      <span>Knockout Only</span>
                      <input type="checkbox" className="h-4 w-4" />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex items-center w-full justify-between">
                      <span>Completed</span>
                      <input type="checkbox" className="h-4 w-4" />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Name (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Name (Z-A)
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Most Participants
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Tournament Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-center">Participants</TableHead>
                  <TableHead className="text-center">Duration</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTournaments.length > 0 ? (
                  filteredTournaments.map((tournament) => (
                    <TableRow key={tournament.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tournament/${tournament.id}`} className="hover:text-primary">
                          {tournament.name}
                        </Link>
                      </TableCell>
                      <TableCell>{tournament.managerName}</TableCell>
                      <TableCell className="text-center">{tournament.participantCount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{tournament.startGameweek} - {tournament.endGameweek}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={`${tournament.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} hover:bg-opacity-90`}
                        >
                          {tournament.isActive ? 'Active' : 'Completed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-full bg-muted rounded-full h-2.5 dark:bg-gray-700">
                          <div 
                            className="bg-primary h-2.5 rounded-full" 
                            style={{ width: `${tournament.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-center mt-1 text-muted-foreground">
                          {tournament.progress}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Link href={`/tournament/${tournament.id}`} className="flex items-center w-full">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                <span>View</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Link href={`/tournament/${tournament.id}/manage`} className="flex items-center w-full">
                                <Trophy className="mr-2 h-4 w-4" />
                                <span>Manage</span>
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Trophy className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No tournaments found</p>
                        {searchQuery && (
                          <p className="text-sm text-muted-foreground">
                            Try adjusting your search or filters
                          </p>
                        )}
                        {!searchQuery && (
                          <Link href="/tournament/create">
                            <Button className="mt-2" size="sm">
                              Create Your First Tournament
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Showing {filteredTournaments.length} of {mockTournaments.length} tournaments</span>
            </div>
            
            {(showOnlyMine || showOnlyActive || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowOnlyMine(false);
                  setShowOnlyActive(false);
                  setSearchQuery("");
                }}
                className="text-muted-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      </div>
    </RootLayout>
  );
}