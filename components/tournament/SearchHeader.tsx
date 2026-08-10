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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("LiveTournament");
  const { searchQuery, setSearchQuery } = props;
  return (
    <div className="mb-6 space-y-3">
      <div className="relative w-full">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label={t("search")}
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 min-h-10 w-full pl-9 pr-9 sm:h-9 sm:min-h-9"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            aria-label={t("clearSearch")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {props.showFilters !== false && (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={props.chipFilter} onValueChange={props.onChipFilterChange}>
          <SelectTrigger className="h-10 min-h-10 sm:h-9 sm:min-h-9" aria-label={t("filterChip")}>
            <SelectValue placeholder={t("filterByChip")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allChips")}</SelectItem>
            <SelectItem value="triple">{t("tripleCaptain")}</SelectItem>
            <SelectItem value="bench">{t("benchBoost")}</SelectItem>
            <SelectItem value="wildcard">{t("wildcard")}</SelectItem>
            <SelectItem value="freehit">{t("freeHit")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={props.captainFilter} onValueChange={props.onCaptainFilterChange}>
          <SelectTrigger className="h-10 min-h-10 sm:h-9 sm:min-h-9" aria-label={t("filterCaptain")}>
            <SelectValue placeholder={t("filterByCaptain")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">{t("allCaptains")}</SelectItem>
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
