"use client"

import { useBrowseKeyboard } from "./use-browse-keyboard"

/**
 * Client component that enables keyboard navigation on the browse page
 * Add this component anywhere within the browse page to activate shortcuts
 */
export function BrowseKeyboardHandler() {
  useBrowseKeyboard()
  return null
}
