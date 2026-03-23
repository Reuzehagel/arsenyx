"use client"

import { Search, FileText, ThumbsUp } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Spinner } from "@/components/ui/spinner"
import { getImageUrl } from "@/lib/warframe/images"
import { slugify } from "@/lib/warframe/slugs"

interface SearchItem {
  uniqueName: string
  name: string
  imageName: string | null
  browseCategory: string
}

interface SearchBuild {
  slug: string
  name: string
  itemName: string
  author: string
  voteCount: number
}

interface SearchResults {
  items: SearchItem[]
  builds: SearchBuild[]
}

export function SearchCommand() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>({
    items: [],
    builds: [],
  })
  const [loading, setLoading] = useState(false)

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Debounced search with AbortController to prevent race conditions
  useEffect(() => {
    if (query.length < 2) {
      setResults({ items: [], builds: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          // Silently fail for non-abort errors
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false)
      setQuery("")
      router.push(path)
    },
    [router],
  )

  const hasResults = results.items.length > 0 || results.builds.length > 0
  const hasQuery = query.length >= 2

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground inline-flex size-9 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <Search className="size-[1.2rem]" />
        <span className="sr-only">Search</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search items and builds..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          )}
          {!loading && hasQuery && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {results.items.length > 0 && (
            <CommandGroup heading="Items">
              {results.items.map((item) => (
                <CommandItem
                  key={item.uniqueName}
                  value={`item-${item.name}`}
                  onSelect={() =>
                    handleSelect(
                      `/browse/${item.browseCategory}/${slugify(item.name)}`,
                    )
                  }
                >
                  <Image
                    src={getImageUrl(item.imageName ?? undefined)}
                    alt={item.name}
                    width={24}
                    height={24}
                    className="rounded"
                    unoptimized
                  />
                  <span>{item.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs capitalize">
                    {item.browseCategory}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.builds.length > 0 && (
            <CommandGroup heading="Builds">
              {results.builds.map((build) => (
                <CommandItem
                  key={build.slug}
                  value={`build-${build.name}`}
                  onSelect={() => handleSelect(`/builds/${build.slug}`)}
                >
                  <FileText className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{build.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {build.itemName} by {build.author}
                    </span>
                  </div>
                  <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
                    <ThumbsUp className="size-3" />
                    {build.voteCount}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
