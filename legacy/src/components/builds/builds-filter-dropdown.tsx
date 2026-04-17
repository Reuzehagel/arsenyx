"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { Icons } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function BuildsFilterDropdown() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasGuide = searchParams.get("hasGuide") === "true"
  const hasShards = searchParams.get("hasShards") === "true"
  const activeFilterCount = [hasGuide, hasShards].filter(Boolean).length

  const toggle = useCallback(
    (key: string, current: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (current) {
        params.delete(key)
      } else {
        params.set(key, "true")
      }
      params.delete("page")
      const next = params.toString()
      router.push(`/builds${next ? `?${next}` : ""}`, { scroll: false })
    },
    [router, searchParams],
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("hasGuide")
    params.delete("hasShards")
    params.delete("page")
    const next = params.toString()
    router.push(`/builds${next ? `?${next}` : ""}`, { scroll: false })
  }, [router, searchParams])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="default" className="shrink-0 gap-2" />
        }
      >
        <Icons.filter data-icon="inline-start" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className={cn(
                "h-auto px-2 py-1 text-xs",
                activeFilterCount === 0 && "invisible",
              )}
            >
              Clear all
            </Button>
          </div>

          <Field>
            <FieldLabel className="text-sm">Build Content</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={hasGuide ? "default" : "outline"}
                size="sm"
                onClick={() => toggle("hasGuide", hasGuide)}
              >
                Has Guide
              </Button>
              <Button
                variant={hasShards ? "default" : "outline"}
                size="sm"
                onClick={() => toggle("hasShards", hasShards)}
              >
                Has Shards
              </Button>
            </div>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
  )
}
