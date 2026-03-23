"use client"

import { Search, Undo2 } from "lucide-react"
import Image from "next/image"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getHelminthAbilities } from "@/lib/warframe/helminth"
import { getImageUrl } from "@/lib/warframe/images"
import type { HelminthAbility } from "@/lib/warframe/types"

interface HelminthAbilityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (ability: HelminthAbility | null) => void
  currentAbilityName?: string
}

export function HelminthAbilityDialog({
  open,
  onOpenChange,
  onSelect,
  currentAbilityName,
}: HelminthAbilityDialogProps) {
  const [query, setQuery] = useState("")
  const abilities = useMemo(() => getHelminthAbilities(), [])

  const filteredAbilities = useMemo(() => {
    if (!query.trim()) return abilities
    const lowerQuery = query.toLowerCase()
    return abilities.filter(
      (a) =>
        a.name.toLowerCase().includes(lowerQuery) ||
        a.source.toLowerCase().includes(lowerQuery),
    )
  }, [abilities, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Subsume Ability</DialogTitle>
        </DialogHeader>

        <InputGroup className="shrink-0">
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search abilities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>

        <ScrollArea className="-mx-6 min-h-0 flex-1 px-6">
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="hover:bg-accent/50 flex h-auto items-center justify-start gap-3 p-3"
              onClick={() => {
                onSelect(null)
                onOpenChange(false)
              }}
            >
              <div className="bg-muted flex size-10 items-center justify-center rounded border">
                <Undo2 className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">Restore Original Ability</span>
                <span className="text-muted-foreground text-xs">
                  Remove Helminth infusion
                </span>
              </div>
            </Button>

            {filteredAbilities.map((ability) => (
              <Button
                key={ability.uniqueName}
                variant={
                  currentAbilityName === ability.name ? "secondary" : "ghost"
                }
                className="hover:bg-accent/50 flex h-auto items-center justify-start gap-3 p-3"
                onClick={() => {
                  onSelect(ability)
                  onOpenChange(false)
                }}
              >
                <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded border">
                  {ability.imageName ? (
                    <Image
                      src={getImageUrl(ability.imageName)}
                      alt={ability.name}
                      fill
                      unoptimized
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
                      ?
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start overflow-hidden text-left">
                  <span className="w-full truncate font-medium">
                    {ability.name}
                  </span>
                  <span className="text-muted-foreground w-full truncate text-xs">
                    {ability.source}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
