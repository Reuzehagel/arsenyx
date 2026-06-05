import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ClipboardPaste, Copy, UploadCloud } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  calculateFormaCount,
  getAuraPolarities,
  getAuraSlotCount,
  getExilusInnatePolarity,
  getNormalSlotCount,
  getStanceInnatePolarity,
  toPolarity,
} from "@/components/build-editor"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requireUser } from "@/lib/auth-guards"
import { saveDraft } from "@/lib/import-draft"
import {
  applyOverframeScrape,
  matchOverframeItem,
  type ScrapeResponse,
} from "@/lib/overframe"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { itemQuery } from "@/lib/queries/item-query"
import { itemsIndexQuery } from "@/lib/queries/items-index-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { apiErrorMessage, apiFetch, ApiError } from "@/lib/util/api-client"
import { copyToClipboard } from "@/lib/util/clipboard"

export const Route = createFileRoute("/import")({
  // Import feeds the sign-in-only editor/save flow, and the API endpoints are
  // auth-gated — bounce anon users to sign-in instead of letting them hit a 401.
  beforeLoad: () => requireUser(),
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

/** Normalise an apiFetch failure into a user-facing import error. */
function importError(err: unknown): Error {
  const fallback =
    err instanceof ApiError ? `Import failed: ${err.status}` : "Import failed"
  return new Error(apiErrorMessage(err, fallback), { cause: err })
}

async function postOverframeImport(url: string): Promise<ScrapeResponse> {
  try {
    return await apiFetch<ScrapeResponse>(`/imports/overframe`, {
      method: "POST",
      json: { url },
    })
  } catch (err) {
    throw importError(err)
  }
}

/** Sentinel tagging the clipboard payload — shared by the bookmarklet that
 * writes it (buildBookmarklet) and the parser that reads it back. */
const OVERFRAME_PASTE_SOURCE = "arsenyx-overframe"

/** Payload the bookmarklet copies to the clipboard. */
type PastedOverframe = {
  source?: string
  url?: string
  nextData?: unknown
}

/**
 * Interpret pasted clipboard text. The bookmarklet wraps the page's
 * __NEXT_DATA__ as `{ source: "arsenyx-overframe", url, nextData }`; we also
 * accept a bare __NEXT_DATA__ blob in case someone copies it by hand.
 */
function parsePastedOverframe(text: string): {
  nextData: unknown
  url?: string
} {
  const obj = JSON.parse(text.trim()) as PastedOverframe
  // A non-object (number/string/array primitive, or null) is never a valid
  // __NEXT_DATA__ blob — reject it here so the caller surfaces the friendly
  // "doesn't look like Overframe build data" message instead of a bare 400.
  if (!obj || typeof obj !== "object") {
    throw new Error("Pasted data is not an object")
  }
  if (obj.source === OVERFRAME_PASTE_SOURCE) {
    return {
      nextData: obj.nextData,
      url: typeof obj.url === "string" ? obj.url : undefined,
    }
  }
  return { nextData: obj }
}

async function importPastedOverframe(text: string): Promise<ScrapeResponse> {
  let input: { nextData: unknown; url?: string }
  try {
    input = parsePastedOverframe(text)
  } catch {
    throw new Error(
      "That doesn't look like Overframe build data. Use the bookmarklet on an Overframe build page, then paste here.",
    )
  }
  try {
    return await apiFetch<ScrapeResponse>(`/imports/overframe/raw`, {
      method: "POST",
      json: input,
    })
  } catch (err) {
    throw importError(err)
  }
}

/**
 * The bookmarklet: reads __NEXT_DATA__ off the (already challenge-cleared)
 * Overframe tab, copies it to the clipboard, and opens our import page with
 * `?paste=1`. Built from the live origin so the dev build points at :5173 and
 * prod points at www.arsenyx.com.
 */
function buildBookmarklet(origin: string): string {
  return `javascript:(function(){try{var e=document.getElementById('__NEXT_DATA__');if(!e){alert('Arsenyx: open an Overframe build page first — no build data found here.');return;}var p=JSON.stringify({source:${JSON.stringify(OVERFRAME_PASTE_SOURCE)},url:location.href,nextData:JSON.parse(e.textContent)});navigator.clipboard.writeText(p).then(function(){window.open(${JSON.stringify(`${origin}/import?paste=1`)},'_blank');},function(){alert('Arsenyx: the browser blocked clipboard access. Try clicking the bookmark again.');});}catch(x){alert('Arsenyx import failed: '+(x&&x.message?x.message:x));}})();`
}

function ImportPage() {
  const [url, setUrl] = useState("")
  const navigate = useNavigate()
  const { data: items } = useQuery(itemsIndexQuery)
  const { data: mods } = useQuery(modsQuery)
  const { data: arcanes } = useQuery(arcanesQuery)
  const { data: helminthAbilities } = useQuery(helminthQuery)

  const [pasteText, setPasteText] = useState("")
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const bookmarkRef = useRef<HTMLAnchorElement>(null)
  const isPasteMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("paste") === "1"

  const mutation = useMutation({ mutationFn: postOverframeImport })
  const rawMutation = useMutation({ mutationFn: importPastedOverframe })

  // Only one import path is ever live at a time — each submit handler resets
  // the other mutation (below). So whichever isn't idle is the active one, and
  // result/error read from it as a single source instead of three coalesces
  // that have to stay aligned.
  const active =
    rawMutation.isPending || rawMutation.data || rawMutation.isError
      ? rawMutation
      : mutation
  const result = active.data
  const isError = active.isError
  const errorMessage = (active.error as Error | null)?.message

  const submitPaste = (text: string) => {
    if (!text.trim()) return
    mutation.reset()
    rawMutation.mutate(text)
  }

  // Set the bookmarklet href imperatively — React strips `javascript:` hrefs.
  useEffect(() => {
    if (bookmarkRef.current) {
      bookmarkRef.current.href = buildBookmarklet(window.location.origin)
    }
  }, [])

  // Arriving via the bookmarklet (`?paste=1`): focus the box and best-effort
  // pre-fill it from the clipboard so the user just clicks Import. We fill but
  // don't auto-submit — auto-POSTing whatever happens to be on the clipboard on
  // page load is a surprising side effect; the explicit click is the confirm.
  // Clipboard read can be blocked without a gesture — that's fine, they can
  // paste manually (Ctrl/Cmd+V).
  useEffect(() => {
    if (!isPasteMode) return
    pasteRef.current?.focus()
    void (async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text.trim()) setPasteText(text)
      } catch {
        // No clipboard permission without a gesture — manual paste still works.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fatalWarning = result?.warnings.find(
    (w) =>
      w.type === "invalid_url" ||
      w.type === "fetch_failed" ||
      // The paste/bookmarklet path can't fail to fetch, so a missing
      // __NEXT_DATA__ blob (wrong page copied, or Overframe changed shape) is
      // its terminal failure — surface it as one clear error, not a soft
      // warning followed by a confusing "could not match item".
      w.type === "next_data_missing",
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
    rawMutation.reset()
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

          <details
            className="bg-card rounded-md border p-4"
            // Only force-open on arrival via the bookmarklet; otherwise leave
            // it uncontrolled so the user can freely toggle it.
            {...(isPasteMode ? { open: true } : {})}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Import blocked? Use the bookmarklet
            </summary>
            <div className="mt-4 flex flex-col gap-4 text-sm">
              <p className="text-muted-foreground">
                Overframe sits behind Cloudflare bot protection, so we
                can&apos;t fetch builds server-side. Instead, drag this button
                to your bookmarks bar:
              </p>
              <div>
                {/* href is set imperatively in an effect — React strips
                    javascript: hrefs. */}
                <a
                  ref={bookmarkRef}
                  href="https://www.arsenyx.com/import"
                  onClick={(e) => e.preventDefault()}
                  className="border-primary/40 bg-primary/10 text-primary inline-flex cursor-grab items-center gap-2 rounded-md border px-3 py-1.5 font-medium"
                  title="Drag me to your bookmarks bar"
                >
                  <UploadCloud className="h-4 w-4" /> Import to Arsenyx
                </a>
              </div>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                <li>Open the Overframe build page you want to import.</li>
                <li>
                  Click the bookmarklet — it copies the build and reopens this
                  page.
                </li>
                <li>
                  Paste below (Ctrl/Cmd+V) if it isn&apos;t filled in
                  automatically, then Import.
                </li>
              </ol>
              <textarea
                ref={pasteRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste copied Overframe build data here…"
                rows={4}
                disabled={rawMutation.isPending}
                className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
              />
              <div>
                <Button
                  type="button"
                  onClick={() => submitPaste(pasteText)}
                  disabled={rawMutation.isPending || !pasteText.trim()}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  {rawMutation.isPending ? "Importing…" : "Import pasted data"}
                </Button>
              </div>
            </div>
          </details>

          {isError && (
            <WarningBox
              fatal
              title="Import failed"
              items={[{ tag: "error", text: errorMessage ?? "Import failed" }]}
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
                              stanceInnate: getStanceInnatePolarity(detailItem),
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
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        void copyToClipboard(
          JSON.stringify(payload, null, 2),
          "Debug JSON copied",
        )
      }
    >
      <Copy className="h-4 w-4" /> Copy debug JSON
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
