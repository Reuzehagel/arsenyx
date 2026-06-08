import { API_URL } from "@/lib/util/constants"

export async function downloadMyBuildsExport(): Promise<void> {
  const r = await fetch(`${API_URL}/me/builds/export`, {
    credentials: "include",
  })
  if (!r.ok) throw new Error("failed to export builds")
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const disposition = r.headers.get("Content-Disposition") ?? ""
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? `arsenyx-builds.json`
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
