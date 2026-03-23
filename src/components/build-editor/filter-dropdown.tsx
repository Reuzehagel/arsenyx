"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface FilterDropdownProps {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: FilterDropdownProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="bg-muted/50 border-border/50 hover:bg-muted h-8 gap-1 text-xs"
          />
        }
      >
        {label}
        <svg
          className="size-3 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1" align="start">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              "hover:bg-muted w-full rounded px-2 py-1.5 text-left text-sm transition-colors",
              value === option && "bg-muted font-medium",
            )}
          >
            {option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
