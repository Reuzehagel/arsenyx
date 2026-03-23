"use client"

import { Link2, Share2, ImageIcon, Download } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const emptySubscribe = () => () => {}
const getCanShare = () => typeof navigator !== "undefined" && !!navigator.share
const getServerCanShare = () => false

interface ShareButtonProps {
  buildName: string
  itemName: string
  buildSlug: string
}

export function ShareButton({
  buildName,
  itemName,
  buildSlug,
}: ShareButtonProps) {
  const canShare = useSyncExternalStore(
    emptySubscribe,
    getCanShare,
    getServerCanShare,
  )
  const [imageLoading, setImageLoading] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success("Link copied!"),
      () => toast.error("Failed to copy link"),
    )
  }

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${buildName} - ${itemName} Build | ARSENYX`,
        url: window.location.href,
      })
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        toast.error("Failed to share")
      }
    }
  }

  const fetchImageBlob = () =>
    fetch(`/api/builds/${buildSlug}/image`).then((res) => {
      if (!res.ok) throw new Error("Failed to generate image")
      return res.blob()
    })

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const safeName = `${buildName}-${itemName}`.replace(/[<>:"/\\|?*]/g, "_")
    const a = document.createElement("a")
    a.href = url
    a.download = `${safeName}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Image downloaded!")
  }

  const copyImage = () => {
    setImageLoading(true)
    // Pass a Promise<Blob> to ClipboardItem so the browser keeps the
    // user gesture alive while the network request completes.
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": fetchImageBlob() })])
      .then(
        () => toast.success("Image copied!"),
        () => toast.error("Failed to copy image"),
      )
      .finally(() => setImageLoading(false))
  }

  const downloadImage = async () => {
    setImageLoading(true)
    try {
      downloadBlob(await fetchImageBlob())
    } catch {
      toast.error("Failed to generate image")
    } finally {
      setImageLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Share2 data-icon="inline-start" />
        Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={copyLink}>
            <Link2 />
            Copy Link
          </DropdownMenuItem>
          {canShare && (
            <DropdownMenuItem onClick={nativeShare}>
              <Share2 />
              Share...
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={copyImage} disabled={imageLoading}>
            <ImageIcon />
            {imageLoading ? "Generating..." : "Copy Image"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadImage} disabled={imageLoading}>
            <Download />
            {imageLoading ? "Generating..." : "Download Image"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
