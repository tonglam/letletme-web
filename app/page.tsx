"use client";

import RootLayout from "@/components/layout/RootLayout";
import { DeadlineSection } from "@/components/home/DeadlineSection";
import { PriceChangesSection } from "@/components/home/PriceChangesSection";
import { H2HSection } from "@/components/home/H2HSection";
import { StatsSection } from "@/components/home/StatsSection";
import { TeamOfTheWeekSection } from "@/components/home/TeamOfTheWeekSection";
import { GameweekStatsSection } from "@/components/home/GameweekStatsSection";
import { MatchesSection } from "@/components/home/MatchesSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";

export default function Home() {
  return (
    <RootLayout className="!px-0">
      <div className="flex flex-col">
        {/* Deadline section - Light primary background */}
        <section className="bg-primary/5">
          <div className="container max-w-4xl mx-auto px-4">
            <DeadlineSection />
          </div>
        </section>

        {/* Price changes section - White background */}
        <section className="bg-background py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <PriceChangesSection />
          </div>
        </section>

        {/* H2H section - Light gray background */}
        <section className="bg-muted/30 py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <H2HSection />
          </div>
        </section>

        {/* Stats section - White background */}
        <section className="bg-background py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <StatsSection />
          </div>
        </section>

        {/* Team of the Week and Gameweek Stats - Light gray background */}
        <section className="bg-muted/30 py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8">
              <TeamOfTheWeekSection />
              <GameweekStatsSection />
            </div>
          </div>
        </section>

        {/* Matches section - White background */}
        <section className="bg-background py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <MatchesSection />
          </div>
        </section>

        {/* Testimonials section - Light primary background */}
        <section className="bg-primary/5">
          <div className="container max-w-4xl mx-auto px-4">
            <TestimonialsSection />
          </div>
        </section>
      </div>
    </RootLayout>
  );
}