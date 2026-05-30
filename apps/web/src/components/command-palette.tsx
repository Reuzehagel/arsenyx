import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Compass, Hammer, LayoutGrid, ScrollText, User } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { authClient } from "@/lib/auth-client"
import { itemsIndexQuery } from "@/lib/queries/items-index-query"
import { CATEGORIES, getImageUrl, type BrowseItem } from "@/lib/warframe"

const SEARCH_DEBOUNCE_MS = 200

type ItemEntry = BrowseItem & { categoryLabel: string }

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  // cmdk's auto-selection sticks to the last-highlighted value, so when
  // results change underneath (debounce fires, list shrinks, etc.) the
  // selection can land on an item that's no longer rendered. Controlling
  // `value` here lets us re-pin selection to the first item whenever the
  // visible set changes.
  const [selected, setSelected] = useState("")
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (open) return
    setQuery("")
    setDebouncedQuery("")
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => clearTimeout(t)
  }, [query, open])

  const { data: items } = useQuery({ ...itemsIndexQuery, enabled: open })

  const allItems = useMemo<ItemEntry[]>(() => {
    if (!items) return []
    // Dedupe by slug, not uniqueName: modular kitgun barrels (Catchmoon,
    // Sporelacer, Vermisplicer, …) share a single uniqueName across their
    // Primary and Secondary forms, but those are distinct browsable items
    // with distinct slugs. slug is unique per catalog entry, so this keeps
    // every form as its own row while still collapsing true duplicates.
    const byKey = new Map<string, ItemEntry>()
    for (const { id, label } of CATEGORIES) {
      for (const it of items[id] ?? []) {
        if (!byKey.has(it.slug)) {
          byKey.set(it.slug, { ...it, categoryLabel: label })
        }
      }
    }
    return [...byKey.values()]
  }, [items])

  const filteredItems = useMemo<ItemEntry[]>(() => {
    const q = debouncedQuery.toLowerCase()
    if (!q) return allItems.slice(0, 6)
    return allItems
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.displayClass?.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [allItems, debouncedQuery])

  useEffect(() => {
    setSelected(filteredItems[0] ? `item:${filteredItems[0].slug}` : "")
  }, [filteredItems])

  const go = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to items or pages.
        </DialogDescription>
        <Command
          shouldFilter={false}
          value={selected}
          onValueChange={setSelected}
        >
          <CommandInput
            placeholder="Search items or pages…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>

            {!debouncedQuery && (
              <>
                <CommandGroup heading="Navigation">
                  <CommandItem
                    onSelect={() =>
                      go(() =>
                        navigate({
                          to: "/browse",
                          search: { category: "warframes" },
                        }),
                      )
                    }
                  >
                    <Compass />
                    <span>Browse items</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(() => navigate({ to: "/builds" }))}
                  >
                    <LayoutGrid />
                    <span>Community builds</span>
                  </CommandItem>
                  {session?.user ? (
                    <CommandItem
                      onSelect={() =>
                        go(() => navigate({ to: "/builds/mine" }))
                      }
                    >
                      <User />
                      <span>My builds</span>
                    </CommandItem>
                  ) : null}
                  <CommandItem
                    onSelect={() => go(() => navigate({ to: "/changelog" }))}
                  >
                    <ScrollText />
                    <span>Changelog</span>
                    <CommandShortcut>what's new</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
                {filteredItems.length > 0 ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Popular items">
                      {filteredItems.map((item) => (
                        <ItemRow
                          key={item.slug}
                          item={item}
                          onSelect={() =>
                            go(() =>
                              navigate({
                                to: "/browse/$category/$slug",
                                params: {
                                  category: item.category,
                                  slug: item.slug,
                                },
                              }),
                            )
                          }
                        />
                      ))}
                    </CommandGroup>
                  </>
                ) : null}
              </>
            )}

            {debouncedQuery && filteredItems.length > 0 ? (
              <CommandGroup heading="Items">
                {filteredItems.map((item) => (
                  <ItemRow
                    key={item.slug}
                    item={item}
                    onSelect={() =>
                      go(() =>
                        navigate({
                          to: "/browse/$category/$slug",
                          params: { category: item.category, slug: item.slug },
                        }),
                      )
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {debouncedQuery ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() =>
                      go(() =>
                        navigate({
                          to: "/builds",
                          search: { q: debouncedQuery },
                        }),
                      )
                    }
                  >
                    <Hammer />
                    <span>Search all builds for "{debouncedQuery}"</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({
  item,
  onSelect,
}: {
  item: ItemEntry
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`item:${item.slug}`}
      keywords={[item.name, item.displayClass ?? "", item.categoryLabel]}
      onSelect={onSelect}
    >
      <img
        src={getImageUrl(item.imageName)}
        alt=""
        decoding="async"
        className="size-5 object-contain"
      />
      <span>{item.name}</span>
      <CommandShortcut>{item.categoryLabel}</CommandShortcut>
    </CommandItem>
  )
}
