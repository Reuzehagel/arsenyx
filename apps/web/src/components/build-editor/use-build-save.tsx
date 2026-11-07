import type {
  BuildVisibility,
  BuildDetailResponse,
} from "@arsenyx/shared/api/build-dto"
import { BUILD_NAME_MAX } from "@arsenyx/shared/api/limits"
import {
  encodeBuild,
  encodeBuildDoc,
} from "@arsenyx/shared/warframe/build-codec"
import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { computeFormaCount } from "@/lib/build/forma-count"
import type { DetailItem } from "@/lib/catalog"
import {
  buildDocFromVariants,
  editorStateToBuildState,
} from "@/lib/codec/build-codec-adapter"
import { clearEditorDraft } from "@/lib/drafts"
import { HOTKEYS, useHotkey } from "@/lib/hooks/hotkeys"
import { buildKeys } from "@/lib/queries/build-query"
import { apiErrorInfo, apiFetch } from "@/lib/util/api-client"
import { copyToClipboard } from "@/lib/util/clipboard"
import { EXTERNAL_LINKS } from "@/lib/util/constants"
import {
  hasShownDonationNudge,
  markDonationNudgeShown,
} from "@/lib/util/donation-nudge"

import type { EditorCapture } from "./editor-capture"
import type { usePublishSettings } from "./use-publish-settings"

/** Share-link copy, Save (button + Ctrl/Cmd+S), and the publish/update
 *  request with its success/failure toasts. */
export function useBuildSave({
  item,
  category,
  slug,
  existingBuild,
  isUpdate,
  storeKey,
  buildName,
  guide,
  publish,
  formaCount,
  layout,
  displayImageName,
  clampedActiveIndex,
  capture,
}: {
  item: DetailItem
  category: BrowseCategory
  slug: string
  existingBuild: BuildDetailResponse | undefined
  isUpdate: boolean
  storeKey: string
  buildName: string
  guide: { buildSummary: string; buildDescription: string }
  publish: ReturnType<typeof usePublishSettings>
  formaCount: number
  layout: {
    normalSlotCount: number
    auraSlotCount: number
    showStance: boolean
  }
  displayImageName: string | undefined
  clampedActiveIndex: number
  capture: EditorCapture
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving">("idle")

  const handleShare = () => {
    // Build-wide fields + the active variant's live slice; the adapter
    // handles the BuildDoc projection (build-wide/per-variant split).
    const base = {
      item: {
        uniqueName: item.uniqueName,
        name: item.name,
        imageName: item.imageName ?? undefined,
      },
      category,
      buildName: buildName.trim() || item.name,
      ...capture.captureLive(),
      normalSlotCount: layout.normalSlotCount,
      auraSlotCount: layout.auraSlotCount,
      showStance: layout.showStance,
    }
    const allVariants = capture.captureVariants()
    // A single twin-frame variant on a non-primary form still needs the v2 doc
    // encoder — v1 can't carry `formIndex`.
    const needsDoc =
      allVariants.length > 1 || Boolean(allVariants[0]?.formIndex)
    const encoded = needsDoc
      ? encodeBuildDoc(
          buildDocFromVariants(base, allVariants),
          clampedActiveIndex,
        )
      : encodeBuild(editorStateToBuildState(base))
    const url = `${window.location.origin}/create?item=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}&share=${encodeURIComponent(encoded)}`
    void copyToClipboard(url, "Build link copied")
  }

  // A ref, not `saveStatus`: a Retry toast or hotkey can hold a closure from
  // before the save started, and must still see it's in flight.
  const savingRef = useRef(false)

  const performSave = async (
    nextVisibility: BuildVisibility,
    nextOrganizationId: string | null,
    nextHideAuthor: boolean,
  ) => {
    if (!session?.user) {
      goSignIn()
      return
    }
    if (savingRef.current) return
    savingRef.current = true
    // A stale failure toast's Retry would otherwise fire a second save later.
    toast.dismiss(SAVE_ERROR_TOAST)
    setSaveStatus("saving")
    try {
      const buildData = capture.captureBuildData()
      const body = {
        name: buildName.trim() || item.name,
        visibility: nextVisibility,
        organizationId: nextOrganizationId,
        hideAuthor: nextHideAuthor,
        // Strip denormalized mod/arcane/helminth imageName before persisting —
        // images are re-resolved by uniqueName at render time (viewer via
        // image-map.json, editor via the catalog), so storing them just bloats
        // the row and rots across image-scheme changes.
        buildData,
        // Forma count is a projection of buildData + the item's innate
        // polarities (catalog). Compute it here — the only place with the
        // catalog — so the list endpoint can show/sort it without shipping
        // buildData. `catalogVersion` stamps which catalog snapshot it was
        // computed against (server stamps the calc version). Independent
        // variants and twin-frame forms differ, so cards show the highest
        // count of any variant, each against its own form's innates.
        formaCount: Math.max(
          formaCount,
          ...(buildData.variants ?? []).map((v) =>
            computeFormaCount(
              item,
              category,
              v.formaPolarities ?? {},
              v.formIndex,
            ),
          ),
        ),
        catalogVersion: __DATA_VERSION__,
        guide: {
          summary: guide.buildSummary.trim() || null,
          description: guide.buildDescription.trim() || null,
        },
        // itemImageName tracks the incarnon toggle (and any future image
        // change), so update it on PATCH too. The identity fields
        // (itemUniqueName / itemCategory / itemName) stay create-only.
        itemImageName: displayImageName ?? null,
        ...(isUpdate
          ? {}
          : {
              itemUniqueName: item.uniqueName,
              itemCategory: category,
              itemName: item.name,
            }),
      }
      const path = isUpdate ? `/builds/${existingBuild!.slug}` : `/builds`
      const { slug } = await apiFetch<{ id: string; slug: string }>(path, {
        method: isUpdate ? "PATCH" : "POST",
        json: body,
      })
      await queryClient.invalidateQueries({ queryKey: buildKeys.detail(slug) })
      // Every list that can surface this build — browse, my builds,
      // bookmarks, profile — is keyed under `buildKeys.lists` and inherits
      // the default 30s staleTime. Without this, saving a rename
      // (or a new thumbnail / visibility flip) then navigating back to a list
      // shows the OLD row until that staleTime lapses, which reads to users as
      // "my edit didn't save".
      await queryClient.invalidateQueries({ queryKey: buildKeys.lists })
      // Clear the autosaved draft — the saved state is now the source of truth.
      clearEditorDraft(storeKey)
      toast.success(isUpdate ? "Build saved" : "Build published")
      // Moment-of-value donation ask: only after a *new* build is published
      // (not on edits), and only ever once per browser — whether the user
      // tips, dismisses, or ignores it. Kept as a dismissible toast, never a
      // modal/banner, so it stays gentle.
      if (!isUpdate && !hasShownDonationNudge()) {
        markDonationNudgeShown()
        toast(
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium">Thanks for building with Arsenyx</p>
              <p className="text-muted-foreground text-sm">
                It&apos;s free and ad-free, and costs me about $10 a month to
                run. If it&apos;s useful to you, a small tip keeps it going.
              </p>
            </div>
            <div className="flex text-sm">
              <a
                href={EXTERNAL_LINKS.koFi}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-1.5 font-medium transition-colors"
              >
                Support on Ko-fi
              </a>
            </div>
          </div>,
          // Persist until manually dismissed (duration: Infinity) so the ask
          // isn't missed — paired with an explicit close button so dismissal
          // doesn't rely on the user knowing they can swipe a toast away. Still
          // fires at most once per browser (markDonationNudgeShown above).
          { duration: Infinity, closeButton: true },
        )
      }
      navigate({ to: "/builds/$slug", params: { slug } })
    } catch (err) {
      // Re-enable the Save button and surface the failure as a toast. The
      // draft is untouched (it's only cleared on success), so nothing's lost.
      setSaveStatus("idle")
      const { message, retry } = saveErrorText(err, nextOrganizationId != null)
      toast.error(message, {
        id: SAVE_ERROR_TOAST,
        // A failed save is important enough to stay until the user acts on it,
        // rather than auto-dismissing after a few seconds.
        duration: Infinity,
        // Retry only where it can work, and through the latest performSave so
        // it saves the build as it is now, not as it was when this failed.
        action: retry
          ? {
              label: "Retry",
              onClick: () =>
                void performSaveRef.current(
                  nextVisibility,
                  nextOrganizationId,
                  nextHideAuthor,
                ),
            }
          : undefined,
      })
    } finally {
      savingRef.current = false
    }
  }
  const performSaveRef = useRef(performSave)
  performSaveRef.current = performSave

  // Back to this editor after signing in; the draft is still in storage.
  const goSignIn = () =>
    navigate({
      to: "/auth/signin",
      search: { redirect: window.location.pathname + window.location.search },
    })

  const handleSaveClick = () => {
    // Guard re-entry: the Save button is disabled while saving, but the
    // Ctrl/Cmd+S hotkey bypasses that, so a double-press could fire two
    // concurrent saves (duplicate POST, double navigate/toast).
    if (saveStatus === "saving") return
    if (!session?.user) {
      goSignIn()
      return
    }
    if (!isUpdate) {
      publish.setDialogOpen(true)
      return
    }
    void performSave(
      publish.visibility,
      publish.organizationId,
      publish.hideAuthor,
    )
  }

  // Ctrl/Cmd+S saves from anywhere in the editor, including while a text
  // field (name, guide) has focus — hence allowInEditable. preventDefault
  // (the default) stops the browser's own Save dialog.
  useHotkey(HOTKEYS.save, handleSaveClick, { allowInEditable: true })

  return { handleShare, handleSaveClick, performSave, saveStatus }
}

const SAVE_ERROR_TOAST = "build-save-error"

/** What a failed save tells the player, and whether retrying could help.
 *  The API answers with bare codes ("invalid_name"); never show those. */
function saveErrorText(
  err: unknown,
  hasOrg: boolean,
): { message: string; retry: boolean } {
  const { status, code } = apiErrorInfo(err)
  if (status === null)
    return {
      message: "Couldn't reach Arsenyx. Check your connection and retry.",
      retry: true,
    }
  if (status === 401)
    return {
      message: "You've been signed out. Sign in again; your draft is kept.",
      retry: false,
    }
  if (status === 403)
    return {
      message: hasOrg
        ? "You're no longer a member of that organization. Pick another or publish under your name."
        : "You can't edit this build anymore.",
      retry: false,
    }
  if (status === 404)
    return { message: "This build no longer exists.", retry: false }
  if (code === "invalid_name")
    return {
      message: `Build names must be 1 to ${BUILD_NAME_MAX} characters.`,
      retry: false,
    }
  if (code === "too_many_variants")
    return {
      message: `A build can have at most ${MAX_VARIANTS} variants. Delete one and save again.`,
      retry: false,
    }
  if (status >= 500)
    return { message: "Couldn't save the build. Try again.", retry: true }
  return {
    message: "Couldn't save the build: some of its data wasn't accepted.",
    retry: false,
  }
}
