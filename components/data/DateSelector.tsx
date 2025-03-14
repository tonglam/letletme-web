"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { format, subDays } from "date-fns";

interface DateSelectorProps {
  onDateChange: (date: string) => void;
  className?: string;
}

export function DateSelector({ onDateChange, className = "" }: DateSelectorProps) {
  // Generate last 14 days for selection
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 14; i++) {
      const date = subDays(today, i);
      const formattedDate = format(date, "yyyy-MM-dd");
      const displayDate = format(date, "dd MMM yyyy");
      
      dates.push({
        value: formattedDate,
        label: i === 0 ? `Today (${displayDate})` : 
               i === 1 ? `Yesterday (${displayDate})` : 
               displayDate
      });
    }
    
    return dates;
  };

  const dates = generateDates();

  return (
    <Card className={`p-4 ${className}`}>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Select Date</p>
        <Select
          defaultValue={dates[0].value}
          onValueChange={onDateChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select date" />
          </SelectTrigger>
          <SelectContent>
            {dates.map((date) => (
              <SelectItem key={date.value} value={date.value}>
                {date.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}