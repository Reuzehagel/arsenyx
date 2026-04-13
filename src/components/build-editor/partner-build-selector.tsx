"use client"

import { Check, ChevronsUpDown, Search } from "lucide-react"
import Image from "next/image"
import { useState, useMemo } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getImageUrl, getCategoryConfig } from "@/lib/warframe"

import { PartnerBuildCard, type PartnerBuild } from "./partner-build-card"

const MAX_PARTNER_BUILDS = 10

export interface PartnerBuildOption {
  id: string
  slug: string
  name: string
  item: {
    name: string
    imageName: string | null
    browseCategory: string
  }
  buildData: {
    formaCount: number
  }
}

interface PartnerBuildSelectorProps {
  currentBuildId: string
  selectedBuilds: PartnerBuild[]
  availableBuilds: PartnerBuildOption[]
  onAdd: (buildId: string) => void
  onRemove: (buildId: string) => void
  disabled?: boolean
}

function formatCategory(category: string): string {
  const config = getCategoryConfig(
    category as import("@/lib/warframe/types").BrowseCategory,
  )
  return config?.label ?? category
}

export function PartnerBuildSelector({
  currentBuildId,
  selectedBuilds,
  availableBuilds,
  onAdd,
  onRemove,
  disabled = false,
}: PartnerBuildSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [buildToRemove, setBuildToRemove] = useState<PartnerBuild | null>(null)

  const selectedIds = useMemo(
    () => new Set(selectedBuilds.map((b) => b.id)),
    [selectedBuilds],
  )

  const filteredBuilds = useMemo(() => {
    return availableBuilds.filter((build) => {
      // Exclude current build
      if (build.id === currentBuildId) return false
      // Already selected builds shown but disabled
      const matchesSearch =
        searchQuery === "" ||
        build.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        build.item.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [availableBuilds, currentBuildId, searchQuery])

  const canAddMore = selectedBuilds.length < MAX_PARTNER_BUILDS
  const hasNoOtherBuilds =
    availableBuilds.filter((b) => b.id !== currentBuildId).length === 0

  const handleSelect = (buildId: string) => {
    if (!selectedIds.has(buildId) && canAddMore) {
      onAdd(buildId)
    }
    setOpen(false)
    setSearchQuery("")
  }

  const handleRemoveConfirm = () => {
    if (buildToRemove) {
      onRemove(buildToRemove.id)
      setBuildToRemove(null)
    }
  }

  if (hasNoOtherBuilds) {
    return (
      <Alert>
        <AlertDescription>Create more builds to link partners</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search Combobox */}
      <Popover
        open={open}
        onOpenChange={(next) => {
          // Preserve scroll position — portal focus can jump to top on mobile
          const y = window.scrollY
          setOpen(next)
          if (next) requestAnimationFrame(() => window.scrollTo(0, y))
        }}
      >
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled || !canAddMore}
            />
          }
        >
          <span className="text-muted-foreground flex items-center gap-2">
            <Search className="size-4" />
            {canAddMore
              ? "Search your builds..."
              : `Maximum ${MAX_PARTNER_BUILDS} partners reached`}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] min-w-[240px] max-w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search your builds…"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No builds found.</CommandEmpty>
              <CommandGroup>
                {filteredBuilds.map((build) => {
                  const isSelected = selectedIds.has(build.id)
                  const imageUrl = getImageUrl(
                    build.item.imageName ?? undefined,
                  )

                  return (
                    <CommandItem
                      key={build.id}
                      value={build.id}
                      onSelect={() => handleSelect(build.id)}
                      disabled={isSelected}
                      className={cn(
                        "flex items-center gap-3",
                        isSelected && "opacity-50",
                      )}
                    >
                      {/* Item image */}
                      <div className="bg-muted/50 relative size-8 shrink-0 overflow-hidden rounded">
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {build.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {build.item.name} (
                          {formatCategory(build.item.browseCategory)})
                        </p>
                      </div>

                      {/* Status indicator */}
                      {isSelected && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Already linked
                        </span>
                      )}
                      {!isSelected && (
                        <Check className="size-4 opacity-0 group-data-[selected=true]:opacity-100" />
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Partner Builds */}
      {selectedBuilds.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <p className="text-muted-foreground text-right text-xs">
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
  )
}
