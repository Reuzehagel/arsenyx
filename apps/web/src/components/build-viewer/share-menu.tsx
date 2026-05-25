import { Check, Code2, Link2, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"

/**
 * Share dropdown: copy a deep link to the build, or an embed snippet that
 * renders the chrome-less viewer in an iframe.
 */
export function ShareMenu({ slug }: { slug: string }) {
  const { copied, copy } = useCopyToClipboard()
  const buildUrl = () => `${window.location.origin}/builds/${slug}`
  const onCopyLink = () => copy(buildUrl())
  const onCopyEmbed = () =>
    copy(
      `<iframe src="${buildUrl()}?embed=1" style="width:100%;border:none" height="1" loading="lazy"></iframe>`,
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" title="Share" />}
      >
        {copied ? (
          <Check data-icon="inline-start" className="text-green-500" />
        ) : (
          <Share2 data-icon="inline-start" />
        )}
        {copied ? "Copied!" : "Share"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={onCopyLink}>
          <Link2 className="size-4" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyEmbed}>
          <Code2 className="size-4" />
          Copy embed code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
