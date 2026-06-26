import { useNavigate } from "@tanstack/react-router"
import {
  Code2,
  Eye,
  GitFork,
  Link2,
  MoreHorizontal,
  ShieldX,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import {
  useAdminDeleteBuild,
  useAdminSetBuildVisibility,
} from "@/lib/queries/admin-actions"
import { useDeleteBuild, useForkBuild } from "@/lib/queries/build-actions"
import type { BuildDetail } from "@/lib/queries/build-query"
import { copyToClipboard } from "@/lib/util/clipboard"
import { formatVisibility } from "@/lib/util/user-display"

type Visibility = BuildDetail["visibility"]
const VISIBILITIES: Visibility[] = ["PUBLIC", "UNLISTED", "PRIVATE"]

/**
 * "More actions" overflow menu for the viewer header: Fork (anyone signed
 * in), Delete (owner only, behind a confirm dialog). Admins additionally get
 * an in-context moderation section — change visibility / delete — without a
 * trip to the admin panel.
 */
export function BuildActionsMenu({
  slug,
  name,
  isOwner,
  visibility,
}: {
  slug: string
  name: string
  isOwner: boolean
  visibility: Visibility
}) {
  const { data: session } = authClient.useSession()
  const isAdmin =
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true
  const navigate = useNavigate()
  const fork = useForkBuild(slug)
  const del = useDeleteBuild(slug)
  const adminSetVisibility = useAdminSetBuildVisibility(slug)
  const adminDelete = useAdminDeleteBuild()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false)

  const buildUrl = () => `${window.location.origin}/builds/${slug}`
  const onCopyLink = () => void copyToClipboard(buildUrl(), "Link copied")
  const onCopyEmbed = () =>
    void copyToClipboard(
      `<iframe src="${buildUrl()}?embed=1" style="width:100%;border:none" height="1" loading="lazy"></iframe>`,
      "Embed code copied",
    )

  const onFork = () => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    fork.mutate(undefined, {
      onSuccess: ({ slug: newSlug }) => {
        navigate({ to: "/builds/$slug", params: { slug: newSlug } })
      },
    })
  }

  const onDelete = () => {
    del.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        navigate({ to: "/builds/mine" })
      },
    })
  }

  const onAdminDelete = () => {
    adminDelete.mutate(slug, {
      onSuccess: () => {
        setAdminConfirmOpen(false)
        // The build is gone — returning to the viewer would 404.
        navigate({ to: "/" })
      },
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="More actions" />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={onCopyLink}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyEmbed}>
            <Code2 />
            Copy embed code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onFork} disabled={fork.isPending}>
            <GitFork />
            {fork.isPending ? "Forking…" : "Fork"}
          </DropdownMenuItem>
          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Eye />
                    Visibility
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={visibility}
                      onValueChange={(v) => {
                        if (v === visibility) return
                        adminSetVisibility.mutate(v as Visibility)
                      }}
                    >
                      {VISIBILITIES.map((v) => (
                        <DropdownMenuRadioItem key={v} value={v}>
                          {formatVisibility(v)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setAdminConfirmOpen(true)}
                >
                  <ShieldX />
                  Delete (admin)
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this build?</DialogTitle>
            <DialogDescription>
              This permanently removes “{name}”. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={adminConfirmOpen} onOpenChange={setAdminConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this build as admin?</DialogTitle>
            <DialogDescription>
              This permanently removes “{name}” from another user. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdminConfirmOpen(false)}
              disabled={adminDelete.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onAdminDelete}
              disabled={adminDelete.isPending}
            >
              {adminDelete.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
