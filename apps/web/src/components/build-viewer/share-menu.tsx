import { Code2, Link2, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { copyToClipboard } from "@/lib/util/clipboard"

/**
 * Share dropdown: copy a deep link to the build, or an embed snippet that
 * renders the chrome-less viewer in an iframe.
 */
export function ShareMenu({ slug }: { slug: string }) {
  const buildUrl = () => `${window.location.origin}/builds/${slug}`
  const onCopyLink = () => void copyToClipboard(buildUrl(), "Link copied")
  const onCopyEmbed = () =>
    void copyToClipboard(
      `<iframe src="${buildUrl()}?embed=1" style="width:100%;border:none" height="1" loading="lazy"></iframe>`,
      "Embed code copied",
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" title="Share" />}
      >
        <Share2 data-icon="inline-start" />
        Share
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
