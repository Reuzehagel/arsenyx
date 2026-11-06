import { apiCallError, apiResponse } from "./api-client"

/** Download an API response as a file, named by its `Content-Disposition`
 *  (else `fallbackName`). Any failure throws `Error(errMsg)`. */
export async function downloadApiFile(
  path: string,
  fallbackName: string,
  errMsg: string,
): Promise<void> {
  const res = await apiResponse(path).catch((err: unknown) => {
    throw apiCallError(err, { codes: { default: errMsg } })
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const disposition = res.headers.get("Content-Disposition") ?? ""
  const a = document.createElement("a")
  a.href = url
  a.download = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
