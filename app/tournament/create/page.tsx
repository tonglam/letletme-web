"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  RadioGroup, 
  RadioGroupItem 
} from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Trophy, 
  Users, 
  Check, 
  Info, 
  Link as LinkIcon,
  Calendar,
  AlertCircle,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { 
  useReactTable, 
  getCoreRowModel, 
  createColumnHelper,
  flexRender
} from '@tanstack/react-table';
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TournamentHelp } from "@/components/tournament/TournamentHelp";

// Define tournament types
const tournamentTypes = [
  { value: "standard", label: "Standard" },
  { value: "swiss", label: "Swiss Tournament" },
  { value: "knockout", label: "Knockout Tournament" }
];

// Define participant sources
const participantSources = [
  { value: "official", label: "Official Fantasy League" },
  { value: "custom", label: "Custom Selection" },
  { value: "manual", label: "Manual Entry" }
];

// Define group formats
const groupFormats = [
  { value: "none", label: "No Group Stage" },
  { value: "points", label: "Points-based" },
  { value: "headToHead", label: "Head-to-Head" }
];

// Define knockout formats
const knockoutFormats = [
  { value: "none", label: "No Knockout Stage" },
  { value: "single", label: "Single Elimination" },
  { value: "double", label: "Home & Away" }
];

// Define gameweeks
const gameweeks = Array.from({ length: 38 }, (_, i) => ({
  value: `GW${i + 1}`,
  label: `Gameweek ${i + 1}`
}));

// Custom URL validation for Fantasy Premier League URL
// More strict domain validation to prevent typosquatting and similar attacks
const fplUrlRegex = /^https:\/\/fantasy\.premierleague\.com\/leagues\/\d+\/(standings|admin|join).*$/;

// Type for form data
const formSchema = z.object({
  tournamentName: z.string().min(3, "Tournament name must be at least 3 characters"),
  adminId: z.string().optional(),
  creator: z.string().optional(),
  participantSource: z.enum(["official", "custom", "manual"]),
  tournamentType: z.enum(["standard", "swiss", "knockout"]),
  leagueUrl: z.string()
    .refine(val => val === "" || fplUrlRegex.test(val), {
      message: "Please enter a valid Fantasy Premier League URL (e.g., https://fantasy.premierleague.com/leagues/12345/standings)",
    })
    .optional()
    .or(z.literal("")),
  participantCount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 1, {
    message: "Must be a number greater than 1",
  }),
  groupFormat: z.enum(["none", "points", "headToHead"]),
  startGameweek: z.string(),
  endGameweek: z.string(),
  teamsPerGroup: z.string().optional(),
  useAverageScore: z.boolean().optional(),
  qualifiersPerGroup: z.string().optional(),
  knockoutFormat: z.enum(["none", "single", "double"]),
  knockoutRounds: z.string().optional(),
  matchesPerRound: z.string().optional(),
  knockoutStartGW: z.string().optional(),
  knockoutEndGW: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Interface for participant data displayed in the table
interface Participant {
  id: string;
  team: string;
  manager: string;
  overallRank: number;
  totalPoints: number;
  selected: boolean;
}

// Create column helper for the table
const columnHelper = createColumnHelper<Participant>();

export default function CreateTournament() {
  // Form handling
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tournamentName: "",
      adminId: "",
      creator: "",
      participantSource: "official",
      tournamentType: "standard",
      leagueUrl: "",
      participantCount: "4",
      groupFormat: "none",
      startGameweek: "GW22",
      endGameweek: "GW38",
      teamsPerGroup: "2",
      useAverageScore: false,
      qualifiersPerGroup: "2",
      knockoutFormat: "none",
      knockoutRounds: "2",
      matchesPerRound: "1",
      knockoutStartGW: "",
      knockoutEndGW: "",
    }
  });

  // Watch form values for conditional rendering
  const participantSource = watch("participantSource");
  const leagueUrl = watch("leagueUrl");
  const groupFormat = watch("groupFormat");
  const knockoutFormat = watch("knockoutFormat");
  
  // Mock data for the participants table
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [isDomainValid, setIsDomainValid] = useState(true);

  // Update participant count based on league URL or selected participants
  useEffect(() => {
    if (showTable && selectedParticipants.length > 0) {
      setValue("participantCount", selectedParticipants.length.toString());
    }
  }, [selectedParticipants, setValue, showTable]);

  // Validate URL on change with more detailed validation
  useEffect(() => {
    if (leagueUrl) {
      // First check if URL has the correct domain
      try {
        const url = new URL(leagueUrl);
        const hasCorrectDomain = url.hostname === 'fantasy.premierleague.com';
        setIsDomainValid(hasCorrectDomain);
        
        if (!hasCorrectDomain) {
          setUrlValidationError(`Invalid domain: '${url.hostname}'. Only 'fantasy.premierleague.com' is allowed.`);
          return;
        }
        
        // Then check if the full URL matches our required pattern
        if (fplUrlRegex.test(leagueUrl)) {
          setUrlValidationError(null);
        } else {
          setUrlValidationError("Invalid URL format. Expected format: https://fantasy.premierleague.com/leagues/12345/standings");
        }
      } catch (e) {
        setIsDomainValid(false);
        setUrlValidationError("Invalid URL. Please enter a complete URL including https://");
      }
    } else {
      setUrlValidationError(null);
      setIsDomainValid(true);
    }
  }, [leagueUrl]);

  // Columns definition for react-table
  const columns = [
    columnHelper.accessor('selected', {
      header: '',
      cell: ({ row }) => (
        <input 
          type="checkbox" 
          checked={selectedParticipants.includes(row.original.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedParticipants(prev => [...prev, row.original.id]);
            } else {
              setSelectedParticipants(prev => prev.filter(id => id !== row.original.id));
            }
          }}
          className="w-4 h-4 border-gray-300 rounded"
        />
      ),
    }),
    columnHelper.accessor('team', {
      header: 'Team',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('manager', {
      header: 'Manager',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('overallRank', {
      header: 'Overall Rank',
      cell: info => info.getValue().toLocaleString(),
    }),
    columnHelper.accessor('totalPoints', {
      header: 'Total Points',
      cell: info => info.getValue(),
    }),
  ];

  // Initialize the table
  const table = useReactTable({
    data: participants,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Function to check if URL is valid
  const isValidUrl = () => {
    return leagueUrl && fplUrlRegex.test(leagueUrl) && isDomainValid;
  };

  // Function to fetch participants from URL
  const fetchParticipants = () => {
    if (!isValidUrl()) {
      setUrlValidationError("Please enter a valid Fantasy Premier League URL");
      return;
    }
    
    setIsLoading(true);
    setUrlValidationError(null);
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Mock data for demonstration
      const mockParticipants: Participant[] = [
        { id: '1', team: 'Arsenal Guangzhou FC', manager: 'Gunners Fan', overallRank: 120456, totalPoints: 1788, selected: false },
        { id: '2', team: '沉迷于搬砖不想披', manager: 'Brick Layer', overallRank: 345678, totalPoints: 1684, selected: false },
        { id: '3', team: '世俱杯冠军阿森纳', manager: 'Arsenal Champion', overallRank: 67890, totalPoints: 1909, selected: false },
        { id: '4', team: 'Lord Bendtner', manager: 'Nick B', overallRank: 234567, totalPoints: 1555, selected: false },
        { id: '5', team: 'JackieHooooooo', manager: 'Jackie H', overallRank: 456789, totalPoints: 1836, selected: false },
        { id: '6', team: 'WHY NOT', manager: 'Just Because', overallRank: 678901, totalPoints: 1810, selected: false },
        { id: '7', team: '杀猪会 tong牛合屋之人', manager: 'Tong', overallRank: 123456, totalPoints: 1779, selected: false },
        { id: '8', team: 'Arminia Bielefeld', manager: 'German Fan', overallRank: 789012, totalPoints: 1861, selected: false },
      ];
      
      setParticipants(mockParticipants);
      setShowTable(true);
      setIsUrlValid(true);
      setIsLoading(false);
      
      // Pre-select the first 4 participants
      const initialSelection = mockParticipants.slice(0, 4).map(p => p.id);
      setSelectedParticipants(initialSelection);
    }, 1500);
  };

  // Handle form submission
  const onSubmit = (data: FormData) => {
    // If we're using official league but haven't fetched participants
    if (data.participantSource === "official" && !showTable) {
      if (!isValidUrl()) {
        setUrlValidationError("Please enter a valid Fantasy Premier League URL and fetch participants before submitting");
        return;
      }
      
      alert("Please fetch participants from the league URL before creating the tournament");
      return;
    }
    
    // Add selected participants to the data
    const submissionData = {
      ...data,
      selectedParticipants: participants
        .filter(p => selectedParticipants.includes(p.id))
        .map(p => ({ id: p.id, team: p.team, manager: p.manager }))
    };
    
    console.log(submissionData);
    alert("Tournament created successfully!");
  };

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Create Tournament</h1>
        </div>
        
        {/* Help and FAQ Section */}
        <TournamentHelp className="mb-8" />
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Tournament Information</h2>
            
            <div className="space-y-6">
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tournament-name">Tournament Name <span className="text-red-500">*</span></Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-80">Enter a unique name for your tournament</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input 
                  id="tournament-name"
                  {...register("tournamentName")}
                  placeholder="Enter tournament name"
                />
                {errors.tournamentName && (
                  <p className="text-sm text-red-500">{errors.tournamentName.message}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="admin-id">Admin ID <span className="text-red-500">*</span></Label>
                </div>
                <Input 
                  id="admin-id"
                  {...register("adminId")}
                  placeholder="12"
                  readOnly
                />
              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="creator">Creator <span className="text-red-500">*</span></Label>
                </div>
                <Input 
                  id="creator"
                  {...register("creator")}
                  placeholder="tong"
                  readOnly
                />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Participant Source</h2>
            
            <div className="space-y-6">
              <div className="grid gap-3">
                <Label>Source Type <span className="text-red-500">*</span></Label>
                <Controller
                  name="participantSource"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {participantSources.map((source) => (
                        <div key={source.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={source.value} id={`source-${source.value}`} />
                          <Label htmlFor={`source-${source.value}`}>{source.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
              </div>
              
              <div className="grid gap-3">
                <Label>Tournament Type <span className="text-red-500">*</span></Label>
                <Controller
                  name="tournamentType"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {tournamentTypes.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={type.value} id={`type-${type.value}`} />
                          <Label htmlFor={`type-${type.value}`}>{type.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
              </div>
              
              {participantSource === "official" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="league-url">Official League URL <span className="text-red-500">*</span></Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-80">Enter the full URL of your Fantasy Premier League league</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input 
                        id="league-url"
                        {...register("leagueUrl")}
                        placeholder="https://fantasy.premierleague.com/leagues/12345/standings"
                        className={urlValidationError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {(errors.leagueUrl || urlValidationError) && (
                        <p className="text-sm text-red-500 mt-1">{errors.leagueUrl?.message || urlValidationError}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: https://fantasy.premierleague.com/leagues/12345/standings
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={fetchParticipants}
                      disabled={!isValidUrl() || isLoading}
                      className="flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      {isLoading ? "Loading..." : "Fetch"}
                    </Button>
                  </div>

                  {!isDomainValid && leagueUrl && (
                    <Alert className="bg-red-50 border-red-200 mt-3">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>Domain Error:</strong> Only URLs from fantasy.premierleague.com are allowed.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!showTable && isValidUrl() && (
                    <Alert className="bg-blue-50 border-blue-200 mt-3">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        The URL format is valid. Click "Fetch" to load participants from this league.
                      </AlertDescription>
                    </Alert>
                  )}

                  {isUrlValid && showTable && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">
                          Total Teams: <span className="font-medium">{participants.length}</span>, 
                          Selected: <span className="font-medium">{selectedParticipants.length}</span>
                        </p>
                        <div className="text-sm flex items-center gap-1 text-emerald-600">
                          <Check className="h-4 w-4" />
                          <span>League loaded successfully</span>
                        </div>
                      </div>
                      
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            {table.getHeaderGroups().map(headerGroup => (
                              <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                  <TableHead key={header.id}>
                                    {header.isPlaceholder
                                      ? null
                                      : flexRender(
                                          header.column.columnDef.header,
                                          header.getContext()
                                        )}
                                  </TableHead>
                                ))}
                              </TableRow>
                            ))}
                          </TableHeader>
                          <TableBody>
                            {table.getRowModel().rows.map(row => (
                              <TableRow key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        
                        <div className="p-3 bg-accent/20 border-t flex justify-between items-center">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (selectedParticipants.length === participants.length) {
                                setSelectedParticipants([]);
                              } else {
                                setSelectedParticipants(participants.map(p => p.id));
                              }
                            }}
                          >
                            {selectedParticipants.length === participants.length 
                              ? "Deselect All" 
                              : "Select All"}
                          </Button>
                          
                          <div className="text-sm text-muted-foreground">
                            Showing {participants.length} teams
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {participantSource !== "official" && (
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="participant-count">Participant Count <span className="text-red-500">*</span></Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Number of teams participating in the tournament</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input 
                    id="participant-count"
                    type="number"
                    min="2"
                    {...register("participantCount")}
                  />
                  {errors.participantCount && (
                    <p className="text-sm text-red-500">{errors.participantCount.message}</p>
                  )}
                </div>
              )}
            </div>
          </Card>
          
          {((leagueUrl && isUrlValid) || participantSource !== "official") && (
            <>
              <Card className="p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Group Stage Settings</h2>
                
                <div className="space-y-6">
                  <div className="grid gap-3">
                    <Label>Group Format <span className="text-red-500">*</span></Label>
                    <Controller
                      name="groupFormat"
                      control={control}
                      render={({ field }) => (
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            {groupFormats.map((format) => (
                              <SelectItem key={format.value} value={format.value}>
                                {format.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="start-gameweek">Start Gameweek <span className="text-red-500">*</span></Label>
                      <Controller
                        name="startGameweek"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="start-gameweek">
                              <SelectValue placeholder="Select gameweek" />
                            </SelectTrigger>
                            <SelectContent>
                              {gameweeks.map((gw) => (
                                <SelectItem key={gw.value} value={gw.value}>
                                  {gw.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label htmlFor="end-gameweek">End Gameweek <span className="text-red-500">*</span></Label>
                      <Controller
                        name="endGameweek"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="end-gameweek">
                              <SelectValue placeholder="Select gameweek" />
                            </SelectTrigger>
                            <SelectContent>
                              {gameweeks.map((gw) => (
                                <SelectItem key={gw.value} value={gw.value}>
                                  {gw.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                  
                  {groupFormat !== "none" && (
                    <>
                      <div className="grid gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="teams-per-group">Teams Per Group <span className="text-red-500">*</span></Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Number of teams in each group</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input 
                          id="teams-per-group"
                          type="number"
                          min="2"
                          {...register("teamsPerGroup")}
                        />
                        <div className="text-sm text-muted-foreground">
                          Estimated Groups: {Math.ceil(Number(watch("participantCount")) / Number(watch("teamsPerGroup") || 2))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="use-average-score">Use Average Points</Label>
                          </div>
                          <Controller
                            name="useAverageScore"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center h-10">
                                <input
                                  type="checkbox"
                                  id="use-average-score"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  className="w-4 h-4 border-gray-300 rounded"
                                />
                                <label htmlFor="use-average-score" className="ml-2 text-sm text-muted-foreground">
                                  All teams must have equal number of players
                                </label>
                              </div>
                            )}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="qualifiers-per-group">Qualifiers Per Group <span className="text-red-500">*</span></Label>
                          </div>
                          <Input 
                            id="qualifiers-per-group"
                            type="number"
                            min="1"
                            {...register("qualifiersPerGroup")}
                          />
                          <div className="text-sm text-muted-foreground">
                            Teams advancing from each group
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-center gap-2 bg-accent/30 p-4 rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      Tournament will run for <span className="font-semibold">{
                        (() => {
                          const startGw = parseInt(watch("startGameweek").replace("GW", "")) || 1;
                          const endGw = parseInt(watch("endGameweek").replace("GW", "")) || 38;
                          return endGw - startGw + 1;
                        })()
                      } gameweeks</span>
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Knockout Stage Settings</h2>
                
                <div className="space-y-6">
                  <div className="grid gap-3">
                    <Label>Knockout Format <span className="text-red-500">*</span></Label>
                    <Controller
                      name="knockoutFormat"
                      control={control}
                      render={({ field }) => (
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            {knockoutFormats.map((format) => (
                              <SelectItem key={format.value} value={format.value}>
                                {format.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  
                  {knockoutFormat !== "none" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="knockout-rounds">Number of Rounds <span className="text-red-500">*</span></Label>
                          </div>
                          <Input 
                            id="knockout-rounds"
                            type="number"
                            min="1"
                            {...register("knockoutRounds")}
                          />
                          <div className="text-sm text-muted-foreground">
                            Participants: {Math.pow(2, Number(watch("knockoutRounds") || 1))} teams
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="matches-per-round">Matches Per Round <span className="text-red-500">*</span></Label>
                          </div>
                          <Input 
                            id="matches-per-round"
                            type="number"
                            min="1"
                            max={knockoutFormat === "single" ? "1" : "2"}
                            {...register("matchesPerRound")}
                          />
                          {knockoutFormat === "double" && (
                            <div className="text-sm text-muted-foreground">
                              Home & Away requires 2 matches per round
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="knockout-start-gw">Start Gameweek <span className="text-red-500">*</span></Label>
                          <Controller
                            name="knockoutStartGW"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || ""} onValueChange={field.onChange}>
                                <SelectTrigger id="knockout-start-gw">
                                  <SelectValue placeholder="Select gameweek" />
                                </SelectTrigger>
                                <SelectContent>
                                  {gameweeks.map((gw) => (
                                    <SelectItem key={gw.value} value={gw.value}>
                                      {gw.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <Label htmlFor="knockout-end-gw">End Gameweek <span className="text-red-500">*</span></Label>
                          <Controller
                            name="knockoutEndGW"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || ""} onValueChange={field.onChange}>
                                <SelectTrigger id="knockout-end-gw">
                                  <SelectValue placeholder="Select gameweek" />
                                </SelectTrigger>
                                <SelectContent>
                                  {gameweeks.map((gw) => (
                                    <SelectItem key={gw.value} value={gw.value}>
                                      {gw.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          Knockout rounds require at least {Number(watch("knockoutRounds") || 1) * Number(watch("matchesPerRound") || 1)} gameweeks
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </div>
              </Card>
            </>
          )}
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-5 w-5" />
              <span className="text-sm text-muted-foreground">
                Participants: {participantSource === "official" && showTable ? selectedParticipants.length : watch("participantCount")}
              </span>
            </div>
            
            <Button 
              type="submit" 
              size="lg"
              className="flex items-center gap-2"
              disabled={participantSource === "official" && !showTable}
            >
              Create Tournament
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </RootLayout>
  );
}