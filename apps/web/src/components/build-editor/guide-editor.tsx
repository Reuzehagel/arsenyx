import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Link2, X } from "lucide-react"
import { useRef, useState } from "react"

import { MarkdownBody } from "@/components/markdown-body"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  partnerBuildsQuery,
  useBuildSearch,
  useLinkPartner,
  useUnlinkPartner,
  type PartnerBuild,
} from "@/lib/partner-builds-query"
import { getImageUrl } from "@/lib/warframe"

const SUMMARY_MAX = 160

export function GuideEditor({
  summary,
  onSummaryChange,
  description,
  onDescriptionChange,
  buildSlug,
}: {
  summary: string
  onSummaryChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  /**
   * If provided, the editor renders the partner-builds picker bound to
   * this slug. Omitted for unsaved builds — partners can only be linked
   * after the build exists server-side.
   */
  buildSlug?: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">
          Build Guide{" "}
          <span className="text-muted-foreground text-sm font-normal">
            (optional)
          </span>
        </h2>
        <p className="text-muted-foreground text-sm">
          A short summary and a markdown write-up about your build.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="guide-summary">Summary</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {summary.length}/{SUMMARY_MAX}
          </span>
        </div>
        <Input
          id="guide-summary"
          placeholder="One-line pitch — what makes this build tick?"
          value={summary}
          maxLength={SUMMARY_MAX}
          onChange={(e) => onSummaryChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <Tabs defaultValue="edit" className="flex-col">
          <TabsList className="h-8">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <MarkdownTextarea
              value={description}
              onChange={onDescriptionChange}
              placeholder="Write your build guide in markdown — headings, lists, links, code blocks all work. Paste a YouTube or Vimeo link on its own line to embed the video."
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="border-input min-h-64 rounded-lg border px-3 py-2">
              {description.trim() ? (
                <MarkdownPreview source={description} />
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Partner builds</Label>
        <p className="text-muted-foreground text-xs">
          Link related builds — exalted weapons, companion loadouts, alt
          variants. Linked builds show up on both sides.
        </p>
        {buildSlug ? (
          <PartnerBuildsField buildSlug={buildSlug} />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-9 w-full justify-between font-normal"
          >
            <span className="inline-flex items-center gap-2">
              <Link2 className="size-4" />
              Save the build to link partners…
            </span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        )}
      </div>
    </div>
  )
}

function PartnerBuildsField({ buildSlug }: { buildSlug: string }) {
  const { data: partners = [] } = useQuery(partnerBuildsQuery(buildSlug))
  const link = useLinkPartner(buildSlug)
  const unlink = useUnlinkPartner(buildSlug)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const search = useBuildSearch(q)

  const linkedSlugs = new Set(partners.map((p) => p.slug))
  const candidates = (search.data ?? []).filter(
    (b) => b.slug !== buildSlug && !linkedSlugs.has(b.slug),
  )

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-between font-normal"
            />
          }
        >
          <span className="inline-flex items-center gap-2">
            <Link2 className="size-4" />
            Search builds to link…
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a build or item name…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              {q.trim().length < 2 ? (
                <CommandEmpty>Type at least 2 characters.</CommandEmpty>
              ) : search.isLoading ? (
                <CommandEmpty>Searching…</CommandEmpty>
              ) : candidates.length === 0 ? (
                <CommandEmpty>No matches.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {candidates.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={b.id}
                      onSelect={() => {
                        link.mutate(b)
                        setOpen(false)
                        setQ("")
                      }}
                    >
                      <PartnerThumb build={b} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{b.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {b.item.name}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {partners.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {partners.map((p) => (
            <li key={p.id}>
              <PartnerChip build={p} onRemove={() => unlink.mutate(p.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PartnerThumb({ build }: { build: PartnerBuild }) {
  const src = build.item.imageName ? getImageUrl(build.item.imageName) : null
  return (
    <div className="bg-muted flex size-6 shrink-0 items-center justify-center overflow-hidden rounded">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Link2 className="text-muted-foreground size-4" />
      )}
    </div>
  )
}

function PartnerChip({
  build,
  onRemove,
}: {
  build: PartnerBuild
  onRemove: () => void
}) {
  return (
    <span className="bg-muted/40 inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-2 text-xs">
      <PartnerThumb build={build} />
      <span className="max-w-[14ch] truncate">{build.name}</span>
      <button
        type="button"
        aria-label={`Unlink ${build.name}`}
        onClick={onRemove}
        className="hover:bg-accent text-muted-foreground hover:text-accent-foreground flex size-5 items-center justify-center rounded-full"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function MarkdownTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const applyChange = (next: string, selStart: number, selEnd: number) => {
    onChange(next)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.selectionStart = selStart
      el.selectionEnd = selEnd
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const { selectionStart: start, selectionEnd: end, value: v } = el

    // Ctrl/Cmd+B / +I — wrap selection
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === "b" || key === "i") {
        e.preventDefault()
        const wrap = key === "b" ? "**" : "_"
        const selected =
          v.slice(start, end) || (key === "b" ? "bold" : "italic")
        const next = v.slice(0, start) + wrap + selected + wrap + v.slice(end)
        applyChange(
          next,
          start + wrap.length,
          start + wrap.length + selected.length,
        )
        return
      }
    }

    // Tab / Shift+Tab — indent/dedent current line(s)
    if (e.key === "Tab") {
      e.preventDefault()
      const lineStart = v.lastIndexOf("\n", start - 1) + 1
      const lineEndIdx = v.indexOf("\n", end)
      const blockEnd = lineEndIdx === -1 ? v.length : lineEndIdx
      const block = v.slice(lineStart, blockEnd)
      const lines = block.split("\n")
      let delta = 0
      const newLines = lines.map((line) => {
        if (e.shiftKey) {
          const m = line.match(/^( {1,2}|\t)/)
          if (m) {
            delta -= m[0].length
            return line.slice(m[0].length)
          }
          return line
        }
        delta += 2
        return "  " + line
      })
      const newBlock = newLines.join("\n")
      const next = v.slice(0, lineStart) + newBlock + v.slice(blockEnd)
      const firstLineDelta = e.shiftKey
        ? -(lines[0].match(/^( {1,2}|\t)/)?.[0].length ?? 0)
        : 2
      applyChange(
        next,
        Math.max(lineStart, start + firstLineDelta),
        end + delta,
      )
      return
    }

    // Enter — auto-continue lists
    if (e.key === "Enter" && !e.shiftKey && start === end) {
      const lineStart = v.lastIndexOf("\n", start - 1) + 1
      const line = v.slice(lineStart, start)
      const m = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )(.*)$/)
      if (m) {
        const [, indent, prefix, num, rest] = m
        // Empty item (prefix only) → exit the list by removing the prefix.
        if (rest.trim() === "") {
          e.preventDefault()
          const next = v.slice(0, lineStart) + v.slice(start)
          applyChange(next, lineStart, lineStart)
          return
        }
        // Continue the list.
        e.preventDefault()
        const nextPrefix = num
          ? `${Number(num) + 1}. `
          : prefix.startsWith("- [")
            ? "- [ ] "
            : prefix
        const insertion = "\n" + indent + nextPrefix
        const next = v.slice(0, start) + insertion + v.slice(end)
        const caret = start + insertion.length
        applyChange(next, caret, caret)
        return
      }
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const { selectionStart: start, selectionEnd: end, value: v } = el
    if (start === end) return
    const pasted = e.clipboardData.getData("text/plain").trim()
    if (!/^https?:\/\/\S+$/i.test(pasted)) return
    e.preventDefault()
    const selected = v.slice(start, end)
    const insertion = `[${selected}](${pasted})`
    const next = v.slice(0, start) + insertion + v.slice(end)
    applyChange(next, start + 1, start + 1 + selected.length)
  }

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      className="min-h-64 font-mono text-sm [font-variant-ligatures:none]"
    />
  )
}

function MarkdownPreview({ source }: { source: string }) {
  return (
    <MarkdownBody
      source={source}
      className="prose prose-sm dark:prose-invert [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted [&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_th]:border-border [&_td]:border-border max-w-none [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol_li]:list-decimal [&_p]:mb-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"
    />
  )
}
