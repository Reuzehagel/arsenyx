"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getImageUrl, getCategoryConfig } from "@/lib/warframe";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PartnerBuildCard, type PartnerBuild } from "./partner-build-card";

const MAX_PARTNER_BUILDS = 10;

export interface PartnerBuildOption {
  id: string;
  slug: string;
  name: string;
  item: {
    name: string;
    imageName: string | null;
    browseCategory: string;
  };
  buildData: {
    formaCount: number;
  };
}

interface PartnerBuildSelectorProps {
  currentBuildId: string;
  selectedBuilds: PartnerBuild[];
  availableBuilds: PartnerBuildOption[];
  onAdd: (buildId: string) => void;
  onRemove: (buildId: string) => void;
  disabled?: boolean;
}

function formatCategory(category: string): string {
  const config = getCategoryConfig(category as import("@/lib/warframe/types").BrowseCategory);
  return config?.label ?? category;
}

export function PartnerBuildSelector({
  currentBuildId,
  selectedBuilds,
  availableBuilds,
  onAdd,
  onRemove,
  disabled = false,
}: PartnerBuildSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [buildToRemove, setBuildToRemove] = useState<PartnerBuild | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedBuilds.map((b) => b.id)),
    [selectedBuilds]
  );

  const filteredBuilds = useMemo(() => {
    return availableBuilds.filter((build) => {
      // Exclude current build
      if (build.id === currentBuildId) return false;
      // Already selected builds shown but disabled
      const matchesSearch =
        searchQuery === "" ||
        build.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        build.item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [availableBuilds, currentBuildId, searchQuery]);

  const canAddMore = selectedBuilds.length < MAX_PARTNER_BUILDS;
  const hasNoOtherBuilds =
    availableBuilds.filter((b) => b.id !== currentBuildId).length === 0;

  const handleSelect = (buildId: string) => {
    if (!selectedIds.has(buildId) && canAddMore) {
      onAdd(buildId);
    }
    setOpen(false);
    setSearchQuery("");
  };

  const handleRemoveConfirm = () => {
    if (buildToRemove) {
      onRemove(buildToRemove.id);
      setBuildToRemove(null);
    }
  };

  if (hasNoOtherBuilds) {
    return (
      <Alert>
        <AlertDescription>Create more builds to link partners</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search Combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || !canAddMore}
          />}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="size-4" />
              {canAddMore
                ? "Search your builds..."
                : `Maximum ${MAX_PARTNER_BUILDS} partners reached`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search your builds..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No builds found.</CommandEmpty>
              <CommandGroup>
                {filteredBuilds.map((build) => {
                  const isSelected = selectedIds.has(build.id);
                  const imageUrl = getImageUrl(build.item.imageName ?? undefined);

                  return (
                    <CommandItem
                      key={build.id}
                      value={build.id}
                      onSelect={() => handleSelect(build.id)}
                      disabled={isSelected}
                      className={cn(
                        "flex items-center gap-3",
                        isSelected && "opacity-50"
                      )}
                    >
                      {/* Item image */}
                      <div className="relative size-8 rounded bg-muted/50 shrink-0 overflow-hidden">
                        <Image
                          src={imageUrl}
                          alt={build.item.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>

                      {/* Build info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {build.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {build.item.name} ({formatCategory(build.item.browseCategory)})
                        </p>
                      </div>

                      {/* Status indicator */}
                      {isSelected && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          Already linked
                        </span>
                      )}
                      {!isSelected && (
                        <Check className="size-4 opacity-0 group-data-[selected=true]:opacity-100" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Partner Builds */}
      {selectedBuilds.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedBuilds.map((build) => (
            <PartnerBuildCard
              key={build.id}
              build={build}
              isEditable
              onRemove={() => setBuildToRemove(build)}
            />
          ))}
        </div>
      )}

      {/* Count indicator */}
      {selectedBuilds.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {selectedBuilds.length} / {MAX_PARTNER_BUILDS} partner builds
        </p>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={!!buildToRemove}
        onOpenChange={(open) => !open && setBuildToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove partner build?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{buildToRemove?.name}&quot; from your
              partner builds list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
