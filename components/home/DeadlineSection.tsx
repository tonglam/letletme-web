"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";

export function DeadlineSection() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    // Set deadline to 10 days from now at 02:00:00
    const now = new Date();
    const deadline = addDays(now, 10);
    deadline.setHours(2, 0, 0, 0);
    
    const timer = setInterval(() => {
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Get the deadline date for display
  const deadlineDate = addDays(new Date(), 10);
  deadlineDate.setHours(2, 0, 0, 0);
  const formattedDeadline = format(deadlineDate, "yyyy/MM/dd HH:mm:ss");

  return (
    <div className="py-12 mb-0">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Gameweek 21 Deadline</h1>
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