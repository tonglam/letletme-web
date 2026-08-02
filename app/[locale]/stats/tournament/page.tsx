import { getCurrentAndNextEvents } from "@/lib/events";
import { PageState } from "@/components/feedback/PageState";
import PageShell from "@/components/layout/PageShell";
import { executeServerQuery } from "@/lib/graphql-server";
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_EVENT_RESULTS,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentEventResultItem,
	type TournamentEventResultsResponse,
} from "@/lib/graphql/operations/tournaments";
import { getCurrentEntryId } from "@/lib/session";
import TournamentStatsClient from "@/app/stats/tournament/TournamentStatsClient";
import { CalendarX } from "lucide-react";
import { getPageLocale, getPageMetadata, type LocaleParams } from "@/i18n/page";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: LocaleParams;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await getPageLocale(params);
  return getPageMetadata({
    locale,
    pathname: "/stats/tournament",
    titleKey: "tournamentStatsTitle",
    descriptionKey: "tournamentStatsDescription",
  });
}

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

export default async function TournamentStatsPage({ params, searchParams }: PageProps) {
  await getPageLocale(params);
  const t = await getTranslations("States");
  const resolvedSearchParams = await searchParams;
  const [entryId, events] = await Promise.all([
    getCurrentEntryId(),
    getCurrentAndNextEvents(),
  ]);
  const currentGameweek = events?.current[0]?.id;

  if (!currentGameweek) {
    return (
      <PageShell>
        <PageState
          icon={CalendarX}
          title={t("tournamentStatsUnavailableTitle")}
          description={t("tournamentStatsUnavailableDescription")}
        />
      </PageShell>
    );
  }
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
      initialError = t("tournamentStatsFailed");
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
