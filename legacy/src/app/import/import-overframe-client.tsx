"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type ImportResult = unknown

export function ImportOverframeClient() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const createUrl =
    result && typeof result === "object"
      ? (result as { createUrl?: string | null }).createUrl
      : null

  const pretty = useMemo(() => {
    if (!result) return ""
    try {
      return JSON.stringify(result, null, 2)
    } catch {
      return String(result)
    }
  }, [result])

  async function runImport() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/import/overframe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, encodeBuild: true }),
      })

      const data = (await res.json()) as ImportResult

      if (!res.ok) {
        setError(`HTTP ${res.status}: ${JSON.stringify(data)}`)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Import from Overframe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="overframe-url">Overframe URL</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="overframe-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://overframe.gg/build/…"
                  autoComplete="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button
                  onClick={runImport}
                  disabled={isLoading || url.trim().length === 0}
                >
                  {isLoading ? "Importing..." : "Import"}
                </Button>
                {createUrl ? (
                  <Button
                    variant="secondary"
                    disabled={isLoading}
                    render={<Link href={createUrl} />}
                    nativeButton={false}
                  >
                    Open in editor
                  </Button>
                ) : null}
              </div>
            </Field>
          </FieldGroup>

          {error ? (
            <div className="text-destructive text-sm whitespace-pre-wrap">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted/30 min-h-[160px] rounded-md border p-3 text-xs break-words whitespace-pre-wrap">
            {pretty || "(no response yet)"}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
