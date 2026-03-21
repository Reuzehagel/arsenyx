"use client";

import { useState, useSyncExternalStore } from "react";
import { Link2, Share2, ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emptySubscribe = () => () => {};
const getCanShare = () =>
  typeof navigator !== "undefined" && !!navigator.share;
const getServerCanShare = () => false;

interface ShareButtonProps {
  buildName: string;
  itemName: string;
  buildSlug: string;
}

export function ShareButton({ buildName, itemName, buildSlug }: ShareButtonProps) {
  const canShare = useSyncExternalStore(
    emptySubscribe,
    getCanShare,
    getServerCanShare,
  );
  const [imageLoading, setImageLoading] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${buildName} - ${itemName} Build | ARSENYX`,
        url: window.location.href,
      });
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  const fetchImageBlob = async (): Promise<Blob | null> => {
    try {
      setImageLoading(true);
      const res = await fetch(`/api/builds/${buildSlug}/image`);
      if (!res.ok) throw new Error("Failed to generate image");
      return await res.blob();
    } catch {
      toast.error("Failed to generate image");
      return null;
    } finally {
      setImageLoading(false);
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const safeName = `${buildName}-${itemName}`.replace(/[<>:"/\\|?*]/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Image downloaded!");
  };

  const copyImage = async () => {
    const blob = await fetchImageBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Image copied!");
    } catch {
      // Fallback: download instead
      downloadBlob(blob);
    }
  };

  const downloadImage = async () => {
    const blob = await fetchImageBlob();
    if (!blob) return;
    downloadBlob(blob);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 data-icon="inline-start" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={copyLink}>
            <Link2 />
            Copy Link
          </DropdownMenuItem>
          {canShare && (
            <DropdownMenuItem onSelect={nativeShare}>
              <Share2 />
              Share...
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={copyImage} disabled={imageLoading}>
            <ImageIcon />
            {imageLoading ? "Generating..." : "Copy Image"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={downloadImage} disabled={imageLoading}>
            <Download />
            {imageLoading ? "Generating..." : "Download Image"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
