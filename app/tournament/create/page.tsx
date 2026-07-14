"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  WandSparkles,
  AlertCircle,
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
import { useSession } from "@/lib/auth-client";

// Define participant sources
const participantSources = [
  { value: "official", label: "Official" },
  { value: "custom", label: "Custom" },
];

// Define group formats
const groupFormats = [
  { value: "none", label: "No Group" },
  { value: "points", label: "Points Race" },
];

// Define knockout formats
const knockoutFormats = [
  { value: "none", label: "No Knockout" },
  { value: "single", label: "Single Elimination" },
  { value: "double", label: "Double Elimination" }
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
  adminId: z.string().regex(/^\d+$/, "Admin ID must be a positive number"),
  creator: z.string().trim().min(1, "Creator is required"),
  participantSource: z.enum(["official", "custom"]),
  tournamentType: z.literal("standard"),
  leagueUrl: z.string()
    .refine(val => val === "" || fplUrlRegex.test(val), {
      message: "Please enter a valid Fantasy Premier League URL (e.g., https://fantasy.premierleague.com/leagues/12345/standings)",
    })
    .optional()
    .or(z.literal("")),
  participantCount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Must be a number greater than 0",
  }),
  groupFormat: z.enum(["none", "points"]),
  startGameweek: z.string(),
  endGameweek: z.string(),
  groupNum: z.string().optional(),
  qualifiersPerGroup: z.string().optional(),
  knockoutFormat: z.enum(["none", "single", "double"]),
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

type ParticipantApiItem = Omit<Participant, "selected">;
type PersistedFeedback = {
  submitSuccess: string | null;
  submitError: string | null;
  setupError: string | null;
};

const CREATE_TOURNAMENT_FEEDBACK_KEY = "create-tournament-feedback";

// Create column helper for the table
const columnHelper = createColumnHelper<Participant>();

export default function CreateTournament() {
  const { data: sessionData } = useSession();
  const user = sessionData?.user ?? null;
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
      participantCount: "0",
      groupFormat: "points",
      startGameweek: "GW1",
      endGameweek: "GW38",
      groupNum: "1",
      qualifiersPerGroup: "",
      knockoutFormat: "none",
    }
  });

  // Watch form values for conditional rendering
  const participantSource = watch("participantSource");
  const leagueUrl = watch("leagueUrl");
  const tournamentName = watch("tournamentName");
  const groupFormat = watch("groupFormat");
  const knockoutFormat = watch("knockoutFormat");
  const startGameweek = watch("startGameweek");
  const endGameweek = watch("endGameweek");
  const groupNum = watch("groupNum");
  const qualifiersPerGroup = watch("qualifiersPerGroup");
  const creatorValue = watch("creator");
  
  // Mock data for the participants table
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [isDomainValid, setIsDomainValid] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [createdTournamentId, setCreatedTournamentId] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<"pending" | "processing" | "ready" | "failed" | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [createdParticipantCount, setCreatedParticipantCount] = useState<number | null>(null);
  const [fetchedLeagueUrl, setFetchedLeagueUrl] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameCheckMessage, setNameCheckMessage] = useState<string | null>(null);
  const [isNameAvailable, setIsNameAvailable] = useState<boolean | null>(null);

  const parseGameweekNumber = (value?: string) => {
    const parsed = Number(value?.replace("GW", ""));
    return Number.isInteger(parsed) ? parsed : 0;
  };

  const persistFeedbackAndReload = (payload: PersistedFeedback) => {
    try {
      window.sessionStorage.setItem(
        CREATE_TOURNAMENT_FEEDBACK_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // If sessionStorage is unavailable, continue with refresh anyway.
    }
    window.location.reload();
  };

  const totalEntries = showTable
    ? participantSource === "official"
      ? participants.length
      : selectedParticipants.length
    : 0;
  const groupStartNumber = parseGameweekNumber(startGameweek);
  const groupEndNumber = parseGameweekNumber(endGameweek);
  const groupRounds = Math.max(groupEndNumber - groupStartNumber + 1, 0);
  const groupCount = Math.max(Number(groupNum || "1") || 1, 1);
  const groupQualifyCount = Math.max(Number(qualifiersPerGroup || "0") || 0, 0);
  const computedGroupTeamNum =
    groupFormat === "points" ? Math.ceil(totalEntries / groupCount) : totalEntries;
  const groupStepReady =
    showTable &&
    totalEntries >= 2 &&
    groupStartNumber > 0 &&
    groupEndNumber >= groupStartNumber &&
    (groupFormat === "none" ||
      (groupCount >= 1 &&
        (knockoutFormat === "none" ||
          (groupQualifyCount >= 1 &&
            groupCount * groupQualifyCount <= totalEntries))));
  const knockoutPlayAgainstNum =
    knockoutFormat === "single" ? 1 : knockoutFormat === "double" ? 2 : 0;
  const computedKnockoutTeamNum =
    knockoutFormat === "none"
      ? 0
      : groupFormat === "points"
        ? groupCount * groupQualifyCount
        : totalEntries;
  const computedKnockoutEventNum =
    computedKnockoutTeamNum >= 2 ? Math.ceil(Math.log2(computedKnockoutTeamNum)) : 0;
  const computedKnockoutRounds =
    knockoutFormat === "double"
      ? computedKnockoutEventNum * 2
      : computedKnockoutEventNum;
  const computedKnockoutStartGwNumber = groupEndNumber > 0 ? groupEndNumber + 1 : 0;
  const computedKnockoutEndGwNumber =
    computedKnockoutStartGwNumber > 0
      ? computedKnockoutStartGwNumber + Math.max(computedKnockoutRounds - 1, 0)
      : 0;
  const knockoutStepReady =
    groupStepReady &&
    (knockoutFormat === "none" ||
      (computedKnockoutTeamNum >= 2 &&
        computedKnockoutStartGwNumber > 0 &&
        computedKnockoutEndGwNumber <= 38));

  const applyAutoMode = () => {
    setValue("participantSource", "official");
    setValue("tournamentType", "standard");
    setValue("groupFormat", "points");
    setValue("startGameweek", "GW1");
    setValue("endGameweek", "GW38");
    setValue("groupNum", "1");
    setValue("knockoutFormat", "none");
    setValue("qualifiersPerGroup", "");
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // Update participant count based on league URL or selected participants
  useEffect(() => {
    if (showTable) {
      setValue("participantCount", selectedParticipants.length.toString());
    }
  }, [selectedParticipants, setValue, showTable]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CREATE_TOURNAMENT_FEEDBACK_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedFeedback;
      setSubmitSuccess(parsed.submitSuccess ?? null);
      setSubmitError(parsed.submitError ?? null);
      setSetupError(parsed.setupError ?? null);
      window.sessionStorage.removeItem(CREATE_TOURNAMENT_FEEDBACK_KEY);
    } catch {
      window.sessionStorage.removeItem(CREATE_TOURNAMENT_FEEDBACK_KEY);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!watch("creator")) {
      setValue("creator", (user.name ?? user.email ?? "").toLowerCase());
    }
    if (!watch("adminId")) {
      setValue("adminId", String(user.fplEntryId ?? ""));
    }
  }, [setValue, user, watch]);

  useEffect(() => {
    const normalizedName = tournamentName?.trim() ?? "";

    if (normalizedName.length === 0) {
      setIsCheckingName(false);
      setIsNameAvailable(null);
      setNameCheckMessage(null);
      return;
    }

    if (normalizedName.length < 3) {
      setIsCheckingName(false);
      setIsNameAvailable(false);
      setNameCheckMessage("Tournament name must be at least 3 characters.");
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsCheckingName(true);
        const response = await fetch(
          `/api/tournaments/check-name?name=${encodeURIComponent(normalizedName)}`,
        );
        const result = await response.json();

        if (isCancelled) {
          return;
        }

        setIsNameAvailable(Boolean(result.available));
        setNameCheckMessage(result.message ?? null);
      } catch {
        if (isCancelled) {
          return;
        }

        setIsNameAvailable(false);
        setNameCheckMessage("Failed to check tournament name.");
      } finally {
        if (!isCancelled) {
          setIsCheckingName(false);
        }
      }
    }, 400);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [tournamentName]);

  useEffect(() => {
    if (showTable && participantSource === "official") {
      setSelectedParticipants(participants.map((participant) => participant.id));
    }
  }, [participantSource, participants, showTable]);

  useEffect(() => {
    if (!fetchedLeagueUrl || leagueUrl === fetchedLeagueUrl) {
      return;
    }

    setShowTable(false);
    setIsUrlValid(false);
    setParticipants([]);
    setSelectedParticipants([]);
    setFetchedLeagueUrl(null);
  }, [fetchedLeagueUrl, leagueUrl]);

  useEffect(() => {
    if (!createdTournamentId || !setupStatus || setupStatus === "ready" || setupStatus === "failed") {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/tournaments/setup-status?id=${createdTournamentId}`, {
          cache: "no-store",
        });
        const result = await response.json();

        if (cancelled || !response.ok || !result.success) {
          return;
        }

        setSetupStatus(result.setupStatus);
        setSetupError(result.setupError ?? null);

        if (result.setupStatus === "ready") {
          setSubmitSuccess(
            `Tournament created successfully with ${createdParticipantCount ?? totalEntries} entries.`
          );
        } else if (result.setupStatus === "failed") {
          setSubmitError(result.setupError || "Tournament setup failed after creation.");
          setSubmitSuccess(null);
        }
      } catch {
        if (!cancelled) {
          setSetupError("Tournament was created, but setup status could not be refreshed.");
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [createdParticipantCount, createdTournamentId, setupStatus, totalEntries]);

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
          disabled={participantSource === "official"}
          onChange={(e) => {
            if (participantSource === "official") {
              return;
            }
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
  const fetchParticipants = async () => {
    if (!isValidUrl()) {
      setUrlValidationError("Please enter a valid Fantasy Premier League URL");
      return;
    }
    
    setIsLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setUrlValidationError(null);

    try {
      const response = await fetch(
        `/api/tournaments/participants?leagueUrl=${encodeURIComponent(leagueUrl || "")}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch participants");
      }

      const fetchedParticipants: Participant[] = (result.participants || []).map((participant: ParticipantApiItem) => ({
        ...participant,
        selected: participantSource === "official",
      }));

      setParticipants(fetchedParticipants);
      setShowTable(true);
      setIsUrlValid(true);
      setFetchedLeagueUrl(leagueUrl || null);

      const initialSelection = participantSource === "official"
        ? fetchedParticipants.map((participant) => participant.id)
        : [];
      setSelectedParticipants(initialSelection);
    } catch (error) {
      setUrlValidationError(
        error instanceof Error ? error.message : "Failed to fetch participants"
      );
      setParticipants([]);
      setSelectedParticipants([]);
      setShowTable(false);
      setIsUrlValid(false);
      setFetchedLeagueUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setSetupError(null);
    setCreatedTournamentId(null);
    setSetupStatus(null);
    setCreatedParticipantCount(null);

    // Both participant source types require fetched league participants
    if (!showTable) {
      if (!isValidUrl()) {
        setUrlValidationError("Please enter a valid Fantasy Premier League URL and fetch participants before submitting");
        return;
      }
      
      setSubmitError("Please fetch participants from the league URL before creating the tournament.");
      return;
    }

    if (data.participantSource === "custom" && selectedParticipants.length === 0) {
      setSubmitError("Please select participants for custom selection.");
      return;
    }
    
    // Add selected participants to the data
    const participantIds = data.participantSource === "official"
      ? participants.map((participant) => participant.id)
      : selectedParticipants;

    if (participantIds.length < 2) {
      setSubmitError("Tournament requires at least 2 participants.");
      return;
    }

    if (isCheckingName) {
      setSubmitError("Tournament name is still being checked.");
      return;
    }

    if (isNameAvailable === false) {
      setSubmitError("Tournament name must be unique.");
      return;
    }

    if (!groupStepReady) {
      setSubmitError("Please complete the group phase settings before creating the tournament.");
      return;
    }

    if (!knockoutStepReady) {
      setSubmitError("Please complete the knockout phase settings before creating the tournament.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          selectedParticipantIds: participantIds,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create tournament");
      }

      const participantCount = result.tournament?.participantCount ?? participantIds.length;
      const nextSetupStatus =
        result.setupStatus === "processing" || result.setupStatus === "ready" || result.setupStatus === "failed"
          ? result.setupStatus
          : "pending";

      setCreatedTournamentId(result.tournament?.id ?? null);
      setCreatedParticipantCount(participantCount);
      setSetupStatus(nextSetupStatus);
      setSetupError(null);

      if (nextSetupStatus === "ready") {
        persistFeedbackAndReload({
          submitSuccess: `Tournament created successfully with ${participantCount} entries.`,
          submitError: null,
          setupError: null,
        });
      } else if (nextSetupStatus === "failed") {
        persistFeedbackAndReload({
          submitSuccess: null,
          submitError: "Tournament was created, but backend setup failed.",
          setupError: null,
        });
      } else {
        persistFeedbackAndReload({
          submitSuccess: `Tournament created with ${participantCount} entries. Backend setup is still running.`,
          submitError: null,
          setupError: null,
        });
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create tournament"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Create Tournament</h1>
        </div>
        
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <TournamentHelp />
        </div>
        
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
                {!errors.tournamentName && nameCheckMessage && (
                  <p
                    className={`text-sm ${
                      isCheckingName
                        ? "text-muted-foreground"
                        : isNameAvailable
                          ? "text-emerald-600"
                          : "text-red-500"
                    }`}
                  >
                    {isCheckingName ? "Checking tournament name..." : nameCheckMessage}
                  </p>
                )}
              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="admin-id">Admin ID <span className="text-red-500">*</span></Label>
                </div>
                <Input
                  id="admin-id"
                  {...register("adminId")}
                  placeholder="FPL Entry ID"
                />
                {errors.adminId && (
                  <p className="text-sm text-red-500">{errors.adminId.message}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="creator">Creator <span className="text-red-500">*</span></Label>
                </div>
                <Input 
                  id="creator"
                  {...register("creator")}
                  placeholder="tong"
                  onFocus={() => {
                    if (!creatorValue?.trim()) {
                      setValue("creator", "tong", { shouldValidate: true });
                    }
                  }}
                />
                {errors.creator && (
                  <p className="text-sm text-red-500">{errors.creator.message}</p>
                )}
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
                <p className="text-sm text-muted-foreground">
                  Official includes all entries from the league URL; Custom lets you pick a subset after fetching.
                </p>
              </div>
              
              <div className="grid gap-3">
                <Label>Tournament Type <span className="text-red-500">*</span></Label>
                <Input value="Standard" readOnly />
              </div>
              
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
	                        The URL format is valid. Click &quot;Fetch&quot; to load participants from this league.
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

                      <div className="mb-4 flex justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex items-center gap-2"
                                onClick={applyAutoMode}
                              >
                                <WandSparkles className="h-4 w-4" />
                                <span>Auto Generate Mode</span>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="w-72">
                                Fills the preset mode: Official data, Standard type, Points Race,
                                GW1 to GW38, Group Num 1, and No Knockout.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                          {participantSource === "custom" ? (
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (selectedParticipants.length === participants.length) {
                                  setSelectedParticipants([]);
                                } else {
                                  setSelectedParticipants(participants.map((participant) => participant.id));
                                }
                              }}
                            >
                              {selectedParticipants.length === participants.length 
                                ? "Deselect All" 
                                : "Select All"}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Official source includes all teams
                            </span>
                          )}

                          <div className="text-sm text-muted-foreground">
                            Showing {participants.length} teams
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </Card>
          
          {showTable && (
            <>
              <Card className="p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Group Phase</h2>
                
                <div className="space-y-6">
                  <div className="grid gap-3">
                    <Label>Group Mode <span className="text-red-500">*</span></Label>
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
                  
                  {groupFormat === "points" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="group-num">Group Number <span className="text-red-500">*</span></Label>
                        <Input 
                          id="group-num"
                          type="number"
                          min="1"
                          {...register("groupNum")}
                        />
                      </div>
                      {knockoutFormat !== "none" && (
                        <div className="space-y-3">
                          <Label htmlFor="qualifiers-per-group">Group Qualify Number <span className="text-red-500">*</span></Label>
                          <Input 
                            id="qualifiers-per-group"
                            type="number"
                            min="1"
                            {...register("qualifiersPerGroup")}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-lg bg-accent/30 p-4">
                      <div className="text-sm text-muted-foreground">Total Entries</div>
                      <div className="text-2xl font-semibold">{totalEntries}</div>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-4">
                      <div className="text-sm text-muted-foreground">Group Rounds</div>
                      <div className="text-2xl font-semibold">{groupRounds}</div>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-4">
                      <div className="text-sm text-muted-foreground">Group Team Num</div>
                      <div className="text-2xl font-semibold">{computedGroupTeamNum}</div>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-4">
                      <div className="text-sm text-muted-foreground">Group Num</div>
                      <div className="text-2xl font-semibold">
                        {groupFormat === "points" ? groupCount : 1}
                      </div>
                    </div>
                  </div>

                  {groupFormat === "points" && knockoutFormat !== "none" && groupCount * groupQualifyCount > totalEntries && (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        Group qualify total cannot exceed the total selected entries.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>
              
              {groupStepReady && (
                <Card className="p-6 mb-8">
                  <h2 className="text-xl font-semibold mb-6">Knockout Phase</h2>
                  
                  <div className="space-y-6">
                    <div className="grid gap-3">
                      <Label>Knockout Mode <span className="text-red-500">*</span></Label>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout Team Num</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" ? "--" : computedKnockoutTeamNum}
                        </div>
                      </div>
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout Start GW</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" || computedKnockoutStartGwNumber <= 0
                            ? "--"
                            : `GW${computedKnockoutStartGwNumber}`}
                        </div>
                      </div>
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout End GW</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" || computedKnockoutEndGwNumber <= 0
                            ? "--"
                            : `GW${computedKnockoutEndGwNumber}`}
                        </div>
                      </div>
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout Rounds</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" ? "--" : computedKnockoutRounds}
                        </div>
                      </div>
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout Event Num</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" ? "--" : computedKnockoutEventNum}
                        </div>
                      </div>
                      <div className="rounded-lg bg-accent/30 p-4">
                        <div className="text-sm text-muted-foreground">Knockout Play Against Num</div>
                        <div className="text-2xl font-semibold">
                          {knockoutFormat === "none" ? "--" : knockoutPlayAgainstNum}
                        </div>
                      </div>
                    </div>

                    {knockoutFormat !== "none" && computedKnockoutTeamNum < 2 && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          Knockout phase needs at least 2 qualifying teams.
                        </AlertDescription>
                      </Alert>
                    )}

                    {knockoutFormat !== "none" && computedKnockoutEndGwNumber > 38 && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          Knockout phase exceeds GW38. Reduce qualifying teams or use no knockout.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
          
          {(submitError || submitSuccess || setupError) && (
            <Alert className={`mb-6 ${submitError ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
              {submitError ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
              <AlertDescription className={submitError ? "text-red-800" : "text-emerald-800"}>
                {submitError || submitSuccess || setupError}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-5 w-5" />
              <span className="text-sm text-muted-foreground">
                Participants: {showTable
                  ? participantSource === "official"
                    ? participants.length
                    : selectedParticipants.length
                  : "--"}
              </span>
            </div>
            
            <Button 
              type="submit" 
              size="lg"
              className="flex items-center gap-2"
              disabled={
                !showTable ||
                !groupStepReady ||
                !knockoutStepReady ||
                isSubmitting ||
                isCheckingName ||
                isNameAvailable === false
              }
            >
              {isSubmitting ? "Creating..." : "Create Tournament"}
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </RootLayout>
  );
}
