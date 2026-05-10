import { getCurrentAndNextEvents } from "@/lib/events";
import { executeServerQuery } from "@/lib/graphql-server";
import {
  GET_ENTRY_TOURNAMENTS,
  GET_TOURNAMENT_EVENT_RESULTS,
  type EntryTournament,
  type EntryTournamentsResponse,
  type TournamentEventResultItem,
  type TournamentEventResultsResponse,
} from "@/lib/graphql/queries";
import { getCurrentEntryId } from "@/lib/session";
import TournamentStatsClient from "./TournamentStatsClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchTournamentResults(
  tournamentId: number,
  eventId: number,
): Promise<TournamentEventResultItem[]> {
  if (eventId <= 0) {
    return [];
  }

  const response = await executeServerQuery<TournamentEventResultsResponse>(
    GET_TOURNAMENT_EVENT_RESULTS,
    { tournamentId, eventId },
    { cache: "no-store" },
  );
  return response.tournamentEventResults ?? [];
}

export default async function TournamentStatsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const [entryId, events] = await Promise.all([
    getCurrentEntryId(),
    getCurrentAndNextEvents(),
  ]);
  const currentGameweek = events?.current[0]?.id ?? 1;
  let initialTournaments: EntryTournament[] = [];
  let initialSelectedTournamentId = "";
  let initialDataGameweek: number | null = null;
  let initialCurrentRows: TournamentEventResultItem[] = [];
  let initialError: string | null = null;

  if (entryId) {
    try {
      const tournamentsData = await executeServerQuery<EntryTournamentsResponse>(
        GET_ENTRY_TOURNAMENTS,
        { entryId },
        { cache: "no-store" },
      );
      initialTournaments = tournamentsData.entryTournaments;

      const requestedTournamentId =
        typeof resolvedSearchParams.tournamentId === "string"
          ? resolvedSearchParams.tournamentId
          : "";
      initialSelectedTournamentId =
        initialTournaments.find((tournament) => String(tournament.id) === requestedTournamentId)
          ? requestedTournamentId
          : String(initialTournaments[0]?.id ?? "");

      const tournamentId = Number(initialSelectedTournamentId);
      if (tournamentId > 0) {
        let latestGw = currentGameweek;
        let currentRows = await fetchTournamentResults(tournamentId, latestGw);

        if (currentRows.length === 0) {
          for (let offset = 1; offset <= 4; offset += 1) {
            const fallbackGw = currentGameweek - offset;
            if (fallbackGw <= 0) break;
            const fallbackRows = await fetchTournamentResults(tournamentId, fallbackGw);
            if (fallbackRows.length > 0) {
              latestGw = fallbackGw;
              currentRows = fallbackRows;
              break;
            }
          }
        }

        initialDataGameweek = latestGw;
        initialCurrentRows = currentRows;
      }
    } catch (err) {
      console.error("Failed to seed tournament stats page:", err);
      initialError = "Failed to load tournament stats.";
    }
  }

  return (
    <TournamentStatsClient
      entryId={entryId ?? 0}
      initialCurrentGameweek={currentGameweek}
      initialTournaments={initialTournaments}
      initialSelectedTournamentId={initialSelectedTournamentId}
      initialDataGameweek={initialDataGameweek}
      initialCurrentRows={initialCurrentRows}
      initialError={initialError}
    />
  );
}
