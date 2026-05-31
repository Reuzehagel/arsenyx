import { toast } from "sonner"

/**
 * Write `text` to the clipboard and surface the outcome as a toast. Replaces
 * the old per-button "Copied" label flip — feedback now goes through the one
 * toast primitive everywhere. Clipboard access can be blocked (insecure
 * context, permissions), so failures get their own toast rather than being
 * swallowed silently.
 */
export async function copyToClipboard(
  text: string,
  successMessage = "Copied to clipboard",
) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.error("Couldn't copy to clipboard")
  }
}
