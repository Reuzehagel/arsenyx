"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  masteryMax?: number;
  primeOnly?: boolean;
  hideVaulted?: boolean;
  className?: string;
}

export function FilterPanel({
  masteryMax = 16,
  primeOnly = false,
  hideVaulted = false,
  className,
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParamsString);
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const next = params.toString();
      if (next === searchParamsString) return;
      router.push(`?${next}`, { scroll: false });
    },
    [router, searchParamsString]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    params.delete("mastery");
    params.delete("prime");
    params.delete("vaulted");
    const next = params.toString();
    if (next === searchParamsString) return;
    router.push(`?${next}`, { scroll: false });
  }, [router, searchParamsString]);

  const activeFilterCount = [masteryMax < 16, primeOnly, hideVaulted].filter(
    Boolean
  ).length;

  const filterContent = (
    <div className="space-y-6">
      {/* Mastery Requirement */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Max Mastery Rank</Label>
          <span className="text-sm text-muted-foreground tabular-nums">
            MR {masteryMax}
          </span>
        </div>
        <Slider
          value={[masteryMax]}
          onValueChange={([value]) =>
            updateFilter("mastery", value < 16 ? String(value) : null)
          }
          min={0}
          max={16}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>MR 0</span>
          <span>MR 16</span>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Quick Filters</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={primeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => updateFilter("prime", primeOnly ? null : "true")}
            className="gap-1"
          >
            Prime Only
          </Button>
          <Button
            variant={hideVaulted ? "default" : "outline"}
            size="sm"
            onClick={() => updateFilter("vaulted", hideVaulted ? null : "hide")}
            className="gap-1"
          >
            Hide Vaulted
          </Button>
        </div>
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full"
        >
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: Sidebar panel */}
      <div className={cn("hidden lg:block", className)}>
        <div className="sticky top-20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          {filterContent}
        </div>
      </div>

      {/* Mobile: Sheet */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Icons.settings className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">{filterContent}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
