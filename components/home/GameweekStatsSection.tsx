"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_TOP_TRANSFERS_IN,
  GET_TOP_TRANSFERS_OUT,
  type EventsResponse,
  type TopTransfersResponse
} from "@/lib/graphql/queries";
import { useEffect, useState } from "react";
import { TransferList } from "./TransferList";

interface Transfer {
  position: string;
  player: string;
  club: string;
  transfers: number;
}

// Helper function to normalize position
const normalizePosition = (pos: string | undefined): string => {
  if (!pos) return "UNK";
  const upper = pos.toUpperCase().trim();
  if (upper === "GKP" || upper === "GK") return "GKP";
  if (upper === "DEF") return "DEF";
  if (upper === "MID") return "MID";
  if (upper === "FWD") return "FWD";
  if (upper.includes("GOALKEEPER")) return "GKP";
  if (upper.includes("DEFENDER")) return "DEF";
  if (upper.includes("MIDFIELDER")) return "MID";
  if (upper.includes("FORWARD")) return "FWD";
  return upper;
};

export function GameweekStatsSection() {
  const [transfersIn, setTransfersIn] = useState<Transfer[]>([]);
  const [transfersOut, setTransfersOut] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, get current gameweek
        const eventsResponse = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        
        const currentEvent = eventsResponse.current?.[0];
        if (!currentEvent) {
          throw new Error("No current gameweek found");
        }

        // Fetch transfers in and out
        const [transfersInResponse, transfersOutResponse] = await Promise.all([
          executeQuery<TopTransfersResponse>(
            GET_TOP_TRANSFERS_IN,
            { eventId: currentEvent.id, limit: 5 }
          ),
          executeQuery<TopTransfersResponse>(
            GET_TOP_TRANSFERS_OUT,
            { eventId: currentEvent.id, limit: 5 }
          )
        ]);

        // Map transfers in
        const mappedTransfersIn: Transfer[] = (transfersInResponse.topTransfersIn || []).map((transfer) => ({
          position: normalizePosition(transfer.player.position),
          player: transfer.player.webName,
          club: transfer.player.team?.shortName || transfer.player.team?.name || "",
          transfers: transfer.transfersInEvent,
        }));

        // Map transfers out
        const mappedTransfersOut: Transfer[] = (transfersOutResponse.topTransfersOut || []).map((transfer) => ({
          position: normalizePosition(transfer.player.position),
          player: transfer.player.webName,
          club: transfer.player.team?.shortName || transfer.player.team?.name || "",
          transfers: transfer.transfersOutEvent,
        }));

        setTransfersIn(mappedTransfersIn);
        setTransfersOut(mappedTransfersOut);
      } catch (err) {
        console.error("Failed to fetch transfers:", err);
        setError("Failed to load transfers");
        setTransfersIn([]);
        setTransfersOut([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <TransferList
            title="Top Transfers In"
            transfers={transfersIn}
            type="in"
          />
          <TransferList
            title="Top Transfers Out"
            transfers={transfersOut}
            type="out"
          />
        </div>
      )}
    </Card>
  );
}