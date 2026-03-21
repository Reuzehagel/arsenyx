"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortOption } from "@/lib/warframe/types";

interface SortDropdownProps {
  sortOption: SortOption;
  onSortChange: (value: SortOption) => void;
}

const sortLabels: Record<SortOption, string> = {
  "name-asc": "Name A-Z",
  "name-desc": "Name Z-A",
  "date-desc": "Newest First",
  "date-asc": "Oldest First",
};

export function SortDropdown({ sortOption, onSortChange }: SortDropdownProps) {
  return (
    <div className="shrink-0">
      <Select value={sortOption} onValueChange={(value) => { if (value) onSortChange(value as SortOption); }}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="name-asc">{sortLabels["name-asc"]}</SelectItem>
          <SelectItem value="name-desc">{sortLabels["name-desc"]}</SelectItem>
          <SelectItem value="date-desc">{sortLabels["date-desc"]}</SelectItem>
          <SelectItem value="date-asc">{sortLabels["date-asc"]}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
