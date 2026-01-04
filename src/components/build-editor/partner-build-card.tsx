"use client";

import Image from "next/image";
import Link from "next/link";
import { X, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe";
import { Button } from "@/components/ui/button";
export interface PartnerBuild {
  id: string;
  slug: string;
  name: string;
  item: {
    name: string;
    imageName: string | null;
    browseCategory: string;
  };
  buildData: {
    formaCount?: number;
  };
}

interface PartnerBuildCardProps {
  build: PartnerBuild;
  onRemove?: () => void;
  isEditable?: boolean;
  className?: string;
}

export function PartnerBuildCard({
  build,
  onRemove,
  isEditable = false,
  className,
}: PartnerBuildCardProps) {
  const imageUrl = getImageUrl(build.item.imageName ?? undefined);
  const formaCount = build.buildData?.formaCount ?? 0;

  const content = (
    <div
      className={cn(
        "relative flex items-center gap-3 p-2 rounded-lg border bg-card transition-colors",
        !isEditable && "hover:bg-accent/50 cursor-pointer",
        className
      )}
    >
      {/* Item image */}
      <div className="relative w-10 h-10 rounded bg-muted/50 shrink-0 overflow-hidden">
        <Image
          src={imageUrl}
          alt={build.item.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Build info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{build.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {build.item.name}
        </p>
      </div>

      {/* Forma count */}
      {formaCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Gem className="w-3 h-3" />
          <span>{formaCount}</span>
        </div>
      )}

      {/* Remove button */}
      {isEditable && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-3 h-3" />
          <span className="sr-only">Remove partner build</span>
        </Button>
      )}
    </div>
  );

  if (isEditable) {
    return content;
  }

  return (
    <Link href={`/builds/${build.slug}`} className="block">
      {content}
    </Link>
  );
}

interface DeletedPartnerCardProps {
  className?: string;
}

export function DeletedPartnerCard({ className }: DeletedPartnerCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg border bg-muted/30 opacity-60",
        className
      )}
    >
      <div className="w-10 h-10 rounded bg-muted/50 shrink-0 flex items-center justify-center">
        <X className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Build no longer available</p>
    </div>
  );
}
