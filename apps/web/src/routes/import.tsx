import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, Copy, UploadCloud } from "lucide-react"
import { useMemo, useState } from "react"

import {
  calculateFormaCount,
  getAuraPolarities,
  getAuraSlotCount,
  getExilusInnatePolarity,
  getNormalSlotCount,
  toPolarity,
} from "@/components/build-editor"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { arcanesQuery } from "@/lib/arcanes-query"
import { API_URL } from "@/lib/constants"
import { helminthQuery } from "@/lib/helminth-query"
import { saveDraft } from "@/lib/import-draft"
import { itemQuery } from "@/lib/item-query"
import { itemsIndexQuery } from "@/lib/items-index-query"
import { modsQuery } from "@/lib/mods-query"
import {
  applyOverframeScrape,
  matchOverframeItem,
  type ScrapeResponse,
} from "@/lib/overframe"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"

export const Route = createFileRoute("/import")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(itemsIndexQuery),
      context.queryClient.ensureQueryData(modsQuery),
      context.queryClient.ensureQueryData(arcanesQuery),
      context.queryClient.ensureQueryData(helminthQuery),
    ])
  },
  component: ImportPage,
})

async function postOverframeImport(url: string): Promise<ScrapeResponse> {
  const r = await fetch(`${API_URL}/imports/overframe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string; details?: string }).details ??
        (body as { error?: string }).error ??
        `Import failed: ${r.status}`,
    )
  }
  return r.json()
}

function ImportPage() {
  const [url, setUrl] = useState("")
  const navigate = useNavigate()
  const { data: items } = useQuery(itemsIndexQuery)
  const { data: mods } = useQuery(modsQuery)
  const { data: arcanes } = useQuery(arcanesQuery)
  const { data: helminthAbilities } = useQuery(helminthQuery)

  const mutation = useMutation({ mutationFn: postOverframeImport })
  const result = mutation.data

  const fatalWarning = result?.warnings.find(
    (w) => w.type === "invalid_url" || w.type === "fetch_failed",
  )

  const matchedItem = useMemo(() => {
    if (!result || fatalWarning || !items) return null
    return matchOverframeItem(result, items)
  }, [result, fatalWarning, items])

  const { data: detailItem } = useQuery({
    ...itemQuery(
      matchedItem?.category ?? "warframes",
      matchedItem?.item.slug ?? "__none__",
    ),
    enabled: !!matchedItem,
  })

  const applied = useMemo(() => {
    if (
      !result ||
      fatalWarning ||
      !matchedItem ||
      !detailItem ||
      !mods ||
      !arcanes ||
      !helminthAbilities
    ) {
      return null
    }
    return applyOverframeScrape({
      scrape: result,
      item: matchedItem.item,
      category: matchedItem.category,
      detailItem,
      mods,
      arcanes,
      helminthAbilities,
    })
  }, [
    result,
    fatalWarning,
    matchedItem,
    detailItem,
    mods,
    arcanes,
    helminthAbilities,
  ])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    mutation.mutate(trimmed)
  }

  const onOpenInEditor = () => {
    if (!applied || !matchedItem) return
    const id = saveDraft({
      data: applied.data,
      buildName: applied.buildName,
    })
    navigate({
      to: "/create",
      search: {
        item: matchedItem.item.slug,
        category: matchedItem.category,
        draft: id,
      },
    })
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight">
              <UploadCloud className="h-9 w-9" />
              Import from Overframe
            </h1>
            <p className="text-muted-foreground">
              Paste an overframe.gg build URL. We&apos;ll pull the item, mods,
              arcanes, and polarities so you can continue editing here.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label htmlFor="overframe-url" className="text-sm font-medium">
              Overframe build URL
            </label>
            <div className="flex gap-2">
              <Input
                id="overframe-url"
                type="url"
                placeholder="https://overframe.gg/build/123456/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={mutation.isPending}
                className="flex-1"
                autoFocus
              />
              <Button
                type="submit"
                disabled={mutation.isPending || !url.trim()}
              >
                {mutation.isPending ? "Importing…" : "Import"}
              </Button>
            </div>
          </form>

          {mutation.isError && (
            <WarningBox
              fatal
              title="Import failed"
              items={[
                { tag: "error", text: (mutation.error as Error).message },
              ]}
            />
          )}

          {result && (
            <div className="flex flex-col gap-4">
              {result.warnings.length > 0 && (
                <WarningBox
                  fatal={Boolean(fatalWarning)}
                  title={fatalWarning ? "Import failed" : "Scrape warnings"}
                  items={result.warnings.map((w) => ({
                    tag: w.type,
                    text: w.message,
                  }))}
                />
              )}

              {!fatalWarning && !matchedItem && (
                <WarningBox
                  fatal
                  title="Could not match item"
                  items={[
                    {
                      tag: "item_not_found",
                      text: result.itemName
                        ? `Couldn't match "${result.itemName}" to a known item`
                        : "No item name found in Overframe data",
                    },
                  ]}
                />
              )}

              {applied && matchedItem && (
                <>
                  {applied.warnings.length > 0 && (
                    <WarningBox
                      fatal={false}
                      title="Apply warnings"
                      items={applied.warnings.map((w) => ({
                        tag: w.type,
                        text: w.message,
                      }))}
                    />
                  )}
                  <div className="bg-card rounded-md border p-4">
                    <h2 className="mb-3 text-lg font-semibold">
                      {applied.buildName ?? matchedItem.item.name}
                    </h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Item</dt>
                      <dd>
                        {matchedItem.item.name}{" "}
                        <span className="text-muted-foreground">
                          ({matchedItem.category})
                        </span>
                      </dd>
                      <dt className="text-muted-foreground">Forma</dt>
                      <dd>
                        {detailItem
                          ? calculateFormaCount({
                              auraInnates: getAuraPolarities(
                                detailItem,
                                getAuraSlotCount(
                                  matchedItem.category,
                                  detailItem,
                                ),
                              ),
                              exilusInnate: getExilusInnatePolarity(detailItem),
                              normalInnates: Array.from(
                                {
                                  length: getNormalSlotCount(
                                    matchedItem.category,
                                  ),
                                },
                                (_, i) =>
                                  toPolarity(detailItem.polarities?.[i]),
                              ),
                              formaPolarities:
                                applied.data.formaPolarities ?? {},
                            })
                          : Object.keys(applied.data.formaPolarities ?? {})
                              .length}
                        {result.formaCount != null &&
                          ` (OF reports ${result.formaCount})`}
                      </dd>
                      <dt className="text-muted-foreground">Mods placed</dt>
                      <dd>
                        {Object.keys(applied.data.slots ?? {}).length} /{" "}
                        {result.slots.filter((s) => s.overframeId).length}
                      </dd>
                      <dt className="text-muted-foreground">Arcanes</dt>
                      <dd>
                        {(applied.data.arcanes ?? []).filter(Boolean).length}
                      </dd>
                      {applied.data.helminth && (
                        <>
                          <dt className="text-muted-foreground">Helminth</dt>
                          <dd>
                            {Object.values(applied.data.helminth)[0]?.name ??
                              "—"}
                          </dd>
                        </>
                      )}
                    </dl>
                    <div className="mt-4 flex items-center justify-between">
                      <CopyDebugButton payload={{ scrape: result, applied }} />
                      <Button onClick={onOpenInEditor}>Open in editor</Button>
                    </div>
                  </div>
                  <details className="bg-card rounded-md border p-4 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Raw Overframe slots (debug)
                    </summary>
                    <table className="mt-3 w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left">slot_id</th>
                          <th className="text-left">name</th>
                          <th className="text-left">ofId</th>
                          <th className="text-left">rank</th>
                          <th className="text-left">pol</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {[...result.slots]
                          .sort((a, b) => a.slot_id - b.slot_id)
                          .map((s, i) => (
                            <tr key={i}>
                              <td>{s.slot_id}</td>
                              <td>{s.overframeName ?? "—"}</td>
                              <td>{s.overframeId ?? "—"}</td>
                              <td>{s.rank}</td>
                              <td>{s.polarity ?? `code:${s.polarityCode}`}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function CopyDebugButton({ payload }: { payload: unknown }) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void copy(JSON.stringify(payload, null, 2))}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" /> Copy debug JSON
        </>
      )}
    </Button>
  )
}

function WarningBox({
  fatal,
  title,
  items,
}: {
  fatal: boolean
  title: string
  items: { tag: string; text: string }[]
}) {
  return (
    <div
      className={`rounded-md border p-4 text-sm ${
        fatal
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      <div className="mb-2 font-medium">{title}</div>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i}>
            <span className="font-mono text-xs opacity-70">{it.tag}</span> —{" "}
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
