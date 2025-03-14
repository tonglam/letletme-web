"use client";

import { Card } from "@/components/ui/card";
import { Trophy, Users, Zap, Crown } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

const stats: StatCard[] = [
  {
    label: "Highest Points",
    value: "136",
    icon: <Trophy className="w-5 h-5 text-yellow-500" />,
  },
  {
    label: "Average Points",
    value: "60",
    icon: <Zap className="w-5 h-5 text-blue-500" />,
  },
  {
    label: "Most Captained",
    value: "M.Salah",
    icon: <Crown className="w-5 h-5 text-purple-500" />,
  },
  {
    label: "Total Players",
    value: formatCompactNumber(13978697),
    icon: <Users className="w-5 h-5 text-green-500" />,
  },
];

export function StatsSection() {
  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-6 flex items-center">
        <span className="bg-primary/10 text-primary p-1.5 sm:p-2 rounded-lg mr-2 text-sm sm:text-base">GW20</span>
        Gameweek Stats
      </h2>
      <div className="flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-border">
        {stats.map((stat, index) => (
          <div key={index} className="flex-1 flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:py-0 sm:px-4 first:pl-0 last:pr-0">
            <div className="p-2 rounded-full bg-accent/50">{stat.icon}</div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-lg font-bold truncate">{stat.value}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{stat.label}</p>
                  <p className="text-sm text-muted-foreground">{stat.value}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
    </Card>
  );
}