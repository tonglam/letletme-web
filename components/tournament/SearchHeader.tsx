"use client";

import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  captainOptions: string[];
  chipFilter: string;
  onChipFilterChange: (value: string) => void;
  captainFilter: string;
  onCaptainFilterChange: (value: string) => void;
}

export function SearchHeader({
  searchQuery,
  setSearchQuery,
  captainOptions,
  chipFilter,
  onChipFilterChange,
  captainFilter,
  onCaptainFilterChange,
}: SearchHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="relative w-full">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by team or manager..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 w-full"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Select value={chipFilter} onValueChange={onChipFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by chip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chips</SelectItem>
            <SelectItem value="triple">Triple Captain</SelectItem>
            <SelectItem value="bench">Bench Boost</SelectItem>
            <SelectItem value="wildcard">Wildcard</SelectItem>
          </SelectContent>
        </Select>

        <Select value={captainFilter} onValueChange={onCaptainFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by captain" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All Captains</SelectItem>
            {captainOptions.map((captain) => (
              <SelectItem key={captain} value={captain}>
                {captain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
