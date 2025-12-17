"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BrowseItem } from "@/lib/warframe/types";
import { getImageUrl, getItemUrl } from "@/lib/warframe";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: BrowseItem;
  index?: number;
}

export function ItemCard({ item, index }: ItemCardProps) {
  const imageUrl = getImageUrl(item.imageName);
  const itemUrl = getItemUrl(item.category, item.slug);

  return (
    <Link
      href={itemUrl}
      data-index={index}
      className="group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card className="relative h-full overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-md group-focus-visible:border-primary/50 py-0 gap-0">
        {/* Vaulted badge */}
        {item.vaulted && (
          <Badge
            variant="outline"
            className="absolute top-2 right-2 z-10 bg-background/80 text-xs px-2 py-0.5"
          >
            Vaulted
          </Badge>
        )}

        {/* Image container */}
        <div className="relative aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className={cn(
              "object-cover transition-transform duration-200 group-hover:scale-110",
              !item.imageName && "opacity-50"
            )}
            unoptimized
          />
        </div>

        {/* Info section */}
        <div className="p-3 space-y-1">
          <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {item.type && (
              <span className="truncate max-w-[60%]">{item.type}</span>
            )}
            {item.masteryReq !== undefined && item.masteryReq > 0 && (
              <span className="shrink-0">MR {item.masteryReq}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
