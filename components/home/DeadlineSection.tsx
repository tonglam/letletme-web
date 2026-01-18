"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from "@/lib/graphql/queries";
import { format } from "date-fns";
import { useEffect, useState } from "react";

export function DeadlineSection() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current gameweek ID and next gameweek deadline
    const fetchDeadline = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        
        const currentEvent = response.current?.[0];
        const nextEvent = response.next?.[0];
        
        if (currentEvent && nextEvent) {
          // Use current gameweek ID and next gameweek deadline
          // Parse the deadline and convert from UTC to local timezone
          let deadlineDate: Date;
          
          if (nextEvent.deadlineTime.includes('Z') || nextEvent.deadlineTime.includes('+')) {
            // Already has timezone info - use directly
            deadlineDate = new Date(nextEvent.deadlineTime);
          } else {
            // No timezone info (e.g., "2026-01-24 11:00:00") - treat as UTC
            // Add 'Z' to mark it as UTC, then JavaScript converts to local time
            const isoString = nextEvent.deadlineTime.replace(' ', 'T') + 'Z';
            deadlineDate = new Date(isoString);
          }
          
          // Add 8 hours to fix the timezone offset issue
          deadlineDate.setHours(deadlineDate.getHours() + 8);
          
          setDeadline(deadlineDate);
          setGameweek(nextEvent.id);
        } else {
          throw new Error("No active gameweek found");
        }
      } catch (err) {
        console.error("Failed to fetch deadline:", err);
        
        // Check if it's a network error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('Failed to fetch')) {
          setError("Unable to connect to server. Using fallback data.");
        } else {
          setError("Failed to load deadline. Using fallback data.");
        }
        
        // Fallback to default deadline (10 days from now at 02:00:00)
        const now = new Date();
        const fallbackDeadline = new Date(now);
        fallbackDeadline.setDate(now.getDate() + 10);
        fallbackDeadline.setHours(2, 0, 0, 0);
        setDeadline(fallbackDeadline);
        setGameweek(21); // Default gameweek for fallback
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
      
      // Handle case where deadline has passed
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const formattedDeadline = deadline ? `Deadline: ${format(deadline, "EEE d MMM yyyy, HH:mm")}` : "";

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
        <p className="text-xl text-muted-foreground mb-8">{formattedDeadline}</p>
        <Card className="inline-block p-6 md:p-8 lg:p-10">
          <div className="grid grid-cols-4 gap-4 md:gap-12 lg:gap-16">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">{timeLeft.days}</div>
              <div className="text-sm text-muted-foreground">Days</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1 md:text-5xl lg:text-6xl">{timeLeft.hours}</div>
              <div className="text-sm text-muted-foreground">Hours</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1 md:text-5xl lg:text-6xl">{timeLeft.minutes}</div>
              <div className="text-sm text-muted-foreground">Minutes</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1 md:text-5xl lg:text-6xl">{timeLeft.seconds}</div>
              <div className="text-sm text-muted-foreground">Seconds</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}