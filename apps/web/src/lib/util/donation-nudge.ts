// One-time, per-browser gate for the post-publish donation nudge.
//
// The ask should fire at most once per user — whether they tip, dismiss, or
// ignore it. If storage is unavailable (private mode, blocked) we treat the
// nudge as already shown so we never nag in a context where we can't remember
// having asked.

import { STORAGE_KEYS, storageGet, storageSet } from "./storage"

export function hasShownDonationNudge(): boolean {
  const v = storageGet(STORAGE_KEYS.donationNudgeShown)
  return v === undefined || v === "1"
}

export function markDonationNudgeShown(): void {
  storageSet(STORAGE_KEYS.donationNudgeShown, "1")
}
