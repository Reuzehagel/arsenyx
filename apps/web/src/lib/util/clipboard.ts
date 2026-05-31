import { toast } from "sonner"

/**
 * Write `text` to the clipboard and surface the outcome as a toast. Replaces
 * the old per-button "Copied" label flip — feedback now goes through the one
 * toast primitive everywhere.
 *
 * `navigator.clipboard.writeText` is the happy path, but it rejects in a few
 * common situations: an insecure/iframed context where the API is missing,
 * or — the one that bites most — when it's called from a closing dropdown or
 * popover and the document has briefly lost focus ("document is not focused").
 * So we fall back to a hidden-textarea `execCommand("copy")`, which still
 * works in those cases, before giving up and showing an error.
 */
export async function copyToClipboard(
  text: string,
  successMessage = "Copied to clipboard",
) {
  if (await writeToClipboard(text)) {
    toast.success(successMessage)
  } else {
    toast.error("Couldn't copy to clipboard")
  }
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    // Keep it out of view and out of layout flow, but still selectable.
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.top = "-9999px"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
