import { SITE_URL } from "@arsenyx/shared/seo/site"
import type { OverframeScrapeResponse } from "@arsenyx/shared/warframe/overframe-wire"
import type { BrowseCategory, BrowseItem } from "@arsenyx/shared/warframe/types"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ClipboardPaste, Copy, UploadCloud } from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { requireUser } from "@/lib/auth-guards"
import { computeFormaCount } from "@/lib/build/forma-count"
import { saveImportDraft } from "@/lib/drafts"
import { applyOverframeScrape, matchOverframeItem } from "@/lib/overframe"
import {
  buildBookmarklet,
  buildImportDebug,
  importPastedOverframe,
} from "@/lib/overframe/paste"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { itemQuery } from "@/lib/queries/item-query"
import { itemsIndexQuery } from "@/lib/queries/items-index-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { pageSeo } from "@/lib/seo"
import { copyToClipboard } from "@/lib/util/clipboard"
import { cn } from "@/lib/util/utils"

export const Route = createFileRoute("/_app/import")({
  head: () => pageSeo("/import"),
  /** `?paste=1`: arrived from the bookmarklet with the build on the clipboard. */
  validateSearch: (search: Record<string, unknown>): { paste?: true } =>
    search.paste === 1 || search.paste === "1" ? { paste: true } : {},
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

function ImportPage() {
  const { paste: isPasteMode } = Route.useSearch()
  const { data: items } = useSuspenseQuery(itemsIndexQuery)

  const [pasteText, setPasteText] = useState("")
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const bookmarkRef = useRef<HTMLAnchorElement>(null)

  const rawMutation = useMutation({ mutationFn: importPastedOverframe })
  const result = rawMutation.data

  const submitPaste = (text: string) => {
    if (!text.trim()) return
    rawMutation.mutate(text)
  }

  // Set the bookmarklet href imperatively — React strips `javascript:` hrefs.
  useEffect(() => {
    if (bookmarkRef.current) {
      bookmarkRef.current.href = buildBookmarklet(window.location.origin)
    }
  }, [])

  // Arriving via the bookmarklet: focus the box and best-effort pre-fill it
  // from the clipboard so the user just clicks Import. Fill but don't
  // auto-submit — POSTing whatever is on the clipboard on page load would be a
  // surprising side effect; the explicit click is the confirm. Clipboard read
  // can be blocked without a gesture; manual paste (Ctrl/Cmd+V) still works.
  useEffect(() => {
    if (!isPasteMode) return
    pasteRef.current?.focus()
    void (async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text.trim()) setPasteText(text)
      } catch {
        // No clipboard permission without a gesture.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const matchedItem = useMemo(
    () => (result ? matchOverframeItem(result, items) : null),
    [result, items],
  )

  return (
    <div className="wrap max-w-3xl flex-1 py-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight">
            <UploadCloud className="size-9" />
            Import from Overframe
          </h1>
          <p className="text-muted-foreground">
            Bring an overframe.gg build over with its item, mods, arcanes, and
            polarities so you can continue editing here.
          </p>
        </div>

        <section className="bg-card rounded-md border p-4">
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">
              Overframe sits behind Cloudflare bot protection, so we can&apos;t
              fetch builds server-side. Instead, drag this button to your
              bookmarks bar:
            </p>
            <div>
              {/* The real (javascript:) href is set in an effect. */}
              <a
                ref={bookmarkRef}
                href={`${SITE_URL}/import`}
                onClick={(e) => e.preventDefault()}
                className="border-primary/40 bg-primary/10 text-primary inline-flex cursor-grab items-center gap-2 rounded-md border px-3 py-1.5 font-medium"
                title="Drag me to your bookmarks bar"
              >
                <UploadCloud className="size-4" /> Import to Arsenyx
              </a>
            </div>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
              <li>Open the Overframe build page you want to import.</li>
              <li>
                Click the bookmarklet. It copies the build and reopens this
                page.
              </li>
              <li>
                Paste below (Ctrl/Cmd+V) if it isn&apos;t filled in
                automatically, then Import.
              </li>
            </ol>
            <Textarea
              ref={pasteRef}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste copied Overframe build data here…"
              rows={4}
              disabled={rawMutation.isPending}
              className="font-mono text-xs"
            />
            <div>
              <Button
                type="button"
                onClick={() => submitPaste(pasteText)}
                disabled={rawMutation.isPending || !pasteText.trim()}
              >
                <ClipboardPaste className="size-4" />
                {rawMutation.isPending ? "Importing…" : "Import pasted data"}
              </Button>
            </div>
          </div>
        </section>

        {rawMutation.isError && (
          <WarningBox
            fatal
            title="Import failed"
            items={[
              {
                tag: "error",
                text: rawMutation.error.message || "Import failed",
              },
            ]}
          />
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {result.warnings.length > 0 && (
              <WarningBox
                fatal={false}
                title="Scrape warnings"
                items={result.warnings.map((w) => ({
                  tag: w.type,
                  text: w.message,
                }))}
              />
            )}

            {!matchedItem && (
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

            {matchedItem && (
              <Suspense fallback={null}>
                <ImportResult result={result} matchedItem={matchedItem} />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The applied import for a matched item; suspends on the item's detail. */
function ImportResult({
  result,
  matchedItem,
}: {
  result: OverframeScrapeResponse
  matchedItem: { item: BrowseItem; category: BrowseCategory }
}) {
  const navigate = useNavigate()
  const { data: mods } = useSuspenseQuery(modsQuery)
  const { data: arcanes } = useSuspenseQuery(arcanesQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  const { data: detailItem } = useSuspenseQuery(
    itemQuery(matchedItem.category, matchedItem.item.slug),
  )

  const applied = useMemo(
    () =>
      applyOverframeScrape({
        scrape: result,
        item: matchedItem.item,
        category: matchedItem.category,
        detailItem,
        mods,
        arcanes,
        helminthAbilities,
      }),
    [result, matchedItem, detailItem, mods, arcanes, helminthAbilities],
  )

  const onOpenInEditor = () => {
    const id = saveImportDraft({
      data: applied.data,
      buildName: applied.buildName,
      guideDescription: applied.guideDescription,
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
            {computeFormaCount(
              detailItem,
              matchedItem.category,
              applied.data.formaPolarities ?? {},
              applied.data.formIndex ?? 0,
            )}
            {result.formaCount != null && ` (OF reports ${result.formaCount})`}
          </dd>
          <dt className="text-muted-foreground">Mods placed</dt>
          <dd>
            {Object.keys(applied.data.slots ?? {}).length} /{" "}
            {result.slots.filter((s) => s.overframeId).length}
          </dd>
          <dt className="text-muted-foreground">Arcanes</dt>
          <dd>{(applied.data.arcanes ?? []).filter(Boolean).length}</dd>
          {applied.data.helminth && (
            <>
              <dt className="text-muted-foreground">Helminth</dt>
              <dd>{Object.values(applied.data.helminth)[0]?.name ?? "—"}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Guide</dt>
          <dd>
            {applied.guideDescription
              ? `Imported (${applied.guideDescription.length.toLocaleString()} chars)`
              : "—"}
          </dd>
        </dl>
        <div className="mt-4 flex items-center justify-between">
          <CopyDebugButton
            payload={buildImportDebug(result, applied, matchedItem, detailItem)}
          />
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
      <Copy data-icon="inline-start" /> Copy debug JSON
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
    <Alert
      variant={fatal ? "destructive" : "default"}
      className={cn(
        "p-4",
        fatal
          ? "border-destructive/50 bg-destructive/10"
          : "border-warning/50 bg-warning/10 text-warning",
      )}
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className={cn(!fatal && "text-warning")}>
        <ul className="flex flex-col gap-1">
          {items.map((it, i) => (
            <li key={i}>
              <span className="font-mono text-xs opacity-70">{it.tag}</span> —{" "}
              {it.text}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
