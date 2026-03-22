import Link from "next/link";
import Image from "next/image";
import { ThumbsUp, Eye } from "lucide-react";
import { getImageUrl } from "@/lib/warframe/images";
import type { ReactNode } from "react";

interface BuildCardLinkProps {
  slug: string;
  name: string;
  itemName: string;
  itemImageName: string | null;
  voteCount: number;
  viewCount: number;
  /** Optional content rendered over the image (e.g. visibility badge) */
  imageOverlay?: ReactNode;
  /** Optional subtitle line (e.g. "by username") */
  subtitle?: ReactNode;
  /** Optional extra content after stats */
  footer?: ReactNode;
}

export function BuildCardLink({
  slug,
  name,
  itemName,
  itemImageName,
  voteCount,
  viewCount,
  imageOverlay,
  subtitle,
  footer,
}: BuildCardLinkProps) {
  return (
    <Link
      href={`/builds/${slug}`}
      className="block bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors"
    >
      <div className="relative aspect-video bg-muted/20">
        <Image
          src={getImageUrl(itemImageName ?? undefined)}
          alt={itemName}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover"
        />
        {imageOverlay}
      </div>
      <div className="p-2 flex flex-col gap-1">
        <h3 className="font-medium text-sm line-clamp-1">{name}</h3>
        {subtitle ?? (
          <p className="text-xs text-muted-foreground">{itemName}</p>
        )}
        <BuildStats voteCount={voteCount} viewCount={viewCount} />
        {footer}
      </div>
    </Link>
  );
}

export function BuildStats({
  voteCount,
  viewCount,
}: {
  voteCount: number;
  viewCount: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <ThumbsUp className="size-3" />
        {voteCount}
      </span>
      <span className="flex items-center gap-0.5">
        <Eye className="size-3" />
        {viewCount}
      </span>
    </div>
  );
}
