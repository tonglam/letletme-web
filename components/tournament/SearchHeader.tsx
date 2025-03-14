"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function SearchHeader({ searchQuery, setSearchQuery }: SearchHeaderProps) {
  const [searchOption, setSearchOption] = useState<string>("team");
  const [filterOptions, setFilterOptions] = useState({
    chips: "all",
    status: "all",
    captain: "all"
  });

  // Handle search option change
  const handleSearchOptionChange = (value: string) => {
    setSearchOption(value);
  };

  // Generate placeholder text based on search option
  const getPlaceholderText = () => {
    switch (searchOption) {
      case "team":
        return "Search by team name...";
      case "manager":
        return "Search by manager name...";
      case "captain":
        return "Search by captain name...";
      default:
        return "Search...";
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={getPlaceholderText()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        
        <Select value={searchOption} onValueChange={handleSearchOptionChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Search by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="captain">Captain</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">Chips</DropdownMenuLabel>
              <DropdownMenuItem 
                className={filterOptions.chips === "all" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, chips: "all"})}
              >
                All Teams
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.chips === "triple" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, chips: "triple"})}
              >
                Triple Captain
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.chips === "bench" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, chips: "bench"})}
              >
                Bench Boost
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.chips === "wildcard" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, chips: "wildcard"})}
              >
                Wildcard
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
              <DropdownMenuItem
                className={filterOptions.status === "all" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, status: "all"})}
              >
                All Teams
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.status === "complete" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, status: "complete"})}
              >
                Completed
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.status === "playing" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, status: "playing"})}
              >
                Still Playing
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">Captain</DropdownMenuLabel>
              <DropdownMenuItem
                className={filterOptions.captain === "all" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, captain: "all"})}
              >
                All Captains
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.captain === "salah" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, captain: "salah"})}
              >
                M.Salah
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.captain === "haaland" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, captain: "haaland"})}
              >
                Haaland
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterOptions.captain === "son" ? "bg-accent" : ""}
                onClick={() => setFilterOptions({...filterOptions, captain: "son"})}
              >
                Son
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}