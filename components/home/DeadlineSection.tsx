"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  type EventsResponse,
} from "@/lib/graphql/queries";
import { format } from "date-fns";
import { useEffect, useState } from "react";

export function DeadlineSection() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeadline = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );

        const next = data.next[0];
        if (!next) throw new Error("No upcoming event found");

        setDeadline(new Date(next.deadlineTime));
        setGameweek(next.id);
      } catch (err) {
        console.error("Failed to fetch deadline:", err);
        setError("Failed to load deadline. Using fallback data.");

        const fallbackDeadline = new Date();
        fallbackDeadline.setDate(fallbackDeadline.getDate() + 10);
        fallbackDeadline.setHours(2, 0, 0, 0);
        setDeadline(fallbackDeadline);
        setGameweek(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeadline();
  }, []);

  useEffect(() => {
    if (!deadline) return;

    const timer = setInterval(() => {
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const formattedDeadline = deadline
    ? `Deadline: ${format(deadline, "EEE d MMM yyyy, HH:mm")}`
    : "";

  if (isLoading) {
    return (
      <div className="py-12 mb-0">
        <div className="text-center">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto mb-8" />
          <Card className="inline-block p-6 md:p-8 lg:p-10">
            <div className="grid grid-cols-4 gap-4 md:gap-12 lg:gap-16">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-12 w-16 mx-auto mb-1" />
                  <Skeleton className="h-4 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 mb-0">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          {gameweek ? `Gameweek ${gameweek}` : "Gameweek"}
        </h1>
        {error && (
          <p className="text-sm text-destructive mb-2">{error}</p>
        )}
        <p className="text-xl text-muted-foreground mb-8">
          {formattedDeadline}
        </p>
        <Card className="inline-block p-6 md:p-8 lg:p-10">
          <div className="grid grid-cols-4 gap-4 md:gap-12 lg:gap-16">
            {(
              [
                { value: timeLeft.days, label: "Days" },
                { value: timeLeft.hours, label: "Hours" },
                { value: timeLeft.minutes, label: "Minutes" },
                { value: timeLeft.seconds, label: "Seconds" },
              ] as const
            ).map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-4xl font-bold mb-1 md:text-5xl lg:text-6xl">
                  {value}
                </div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
