import { useState } from "react"

import type { PublishVisibility } from "./publish-dialog"

/** The three publish/attribution settings, edited together in the PublishDialog
 *  and sent together on save. */
export interface PublishSettings {
  visibility: PublishVisibility
  organizationId: string | null
  hideAuthor: boolean
}

export interface PublishSettingsState extends PublishSettings {
  /** Set all three at once — the PublishDialog confirms them as a unit. */
  apply: (next: PublishSettings) => void
  /** Whether the PublishDialog is open. */
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

/**
 * Owns the build editor's publish settings (visibility, organization, hide-author)
 * and the open state of the dialog that edits them. The three values move
 * together — seeded from the existing build, confirmed as a unit via `apply`,
 * and read together by the save path — so they live in one hook rather than four
 * scattered useStates.
 */
export function usePublishSettings(
  initial: PublishSettings,
): PublishSettingsState {
  const [visibility, setVisibility] = useState(initial.visibility)
  const [organizationId, setOrganizationId] = useState(initial.organizationId)
  const [hideAuthor, setHideAuthor] = useState(initial.hideAuthor)
  const [dialogOpen, setDialogOpen] = useState(false)

  const apply = (next: PublishSettings): void => {
    setVisibility(next.visibility)
    setOrganizationId(next.organizationId)
    setHideAuthor(next.hideAuthor)
  }

  return {
    visibility,
    organizationId,
    hideAuthor,
    apply,
    dialogOpen,
    setDialogOpen,
  }
}
