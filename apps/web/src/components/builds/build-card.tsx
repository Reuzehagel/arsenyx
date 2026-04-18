import { Link } from "@tanstack/react-router";
import { ArrowBigUp, Eye } from "lucide-react";

import type { BuildListItem } from "@/lib/builds-list-query";
import { authorName } from "@/lib/user-display";
import { getImageUrl } from "@/lib/warframe";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function BuildCard({ build }: { build: BuildListItem }) {
  const author = authorName(build.user);
  const timeAgo = relativeTime(build.updatedAt);

  return (
    <Link
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/80 block overflow-hidden rounded-lg border transition-colors"
    >
      <div className="bg-muted/20 relative aspect-video">
        <img
          src={getImageUrl(build.item.imageName ?? undefined)}
          alt={build.item.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{build.name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.item.name}
        </p>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {build.organization ? (
            <span className="text-[#a78bfa]">{build.organization.name}</span>
          ) : (
            <>by {author}</>
          )}
        </p>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <ArrowBigUp className="size-3.5" />
              <span className="tabular-nums">{build.voteCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {build.viewCount}
            </span>
          </span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </Link>
  );
}
