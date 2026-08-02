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

interface SearchHeaderBaseProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

type SearchHeaderProps = SearchHeaderBaseProps & ({
  showFilters: false;
} | {
  showFilters?: true;
  captainOptions: string[];
  chipFilter: string;
  onChipFilterChange: (value: string) => void;
  captainFilter: string;
  onCaptainFilterChange: (value: string) => void;
});

export function SearchHeader(props: SearchHeaderProps) {
  const { searchQuery, setSearchQuery } = props;
  return (
    <div className="mb-6 space-y-3">
      <div className="relative w-full">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search by team or manager"
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

      {props.showFilters !== false && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Select value={props.chipFilter} onValueChange={props.onChipFilterChange}>
          <SelectTrigger aria-label="Filter standings by chip">
            <SelectValue placeholder="Filter by chip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chips</SelectItem>
            <SelectItem value="triple">Triple Captain</SelectItem>
            <SelectItem value="bench">Bench Boost</SelectItem>
            <SelectItem value="wildcard">Wildcard</SelectItem>
          </SelectContent>
        </Select>

        <Select value={props.captainFilter} onValueChange={props.onCaptainFilterChange}>
          <SelectTrigger aria-label="Filter standings by captain">
            <SelectValue placeholder="Filter by captain" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All Captains</SelectItem>
            {props.captainOptions.map((captain) => (
              <SelectItem key={captain} value={captain}>
                {captain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      )}
    </div>
  );
}
