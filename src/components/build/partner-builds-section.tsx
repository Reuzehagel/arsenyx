"use client";

import Link from "next/link";
import Image from "next/image";
import { Gem, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe";

export interface VisiblePartnerBuild {
  id: string;
  slug: string;
  name: string;
  isDeleted?: boolean;
  item?: {
    name: string;
    imageName: string | null;
    browseCategory: string;
  };
  buildData?: {
    formaCount?: number;
  };
}

interface PartnerBuildsSectionProps {
  partnerBuilds: VisiblePartnerBuild[];
  className?: string;
}

export function PartnerBuildsSection({
  partnerBuilds,
  className,
}: PartnerBuildsSectionProps) {
  // Filter out any that shouldn't be shown (this is a safety check,
  // visibility filtering should happen server-side)
  const visibleBuilds = partnerBuilds.filter(
    (build) => build.isDeleted || (build.item && build.buildData)
  );

  if (visibleBuilds.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Partner Builds
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visibleBuilds.map((build) =>
          build.isDeleted ? (
            <DeletedPartnerCard key={build.id} />
          ) : (
            <PartnerBuildViewCard key={build.id} build={build} />
          )
        )}
      </div>
    </div>
  );
}

interface PartnerBuildViewCardProps {
  build: VisiblePartnerBuild;
}

function PartnerBuildViewCard({ build }: PartnerBuildViewCardProps) {
  if (!build.item || !build.buildData) {
    return null;
  }

  const imageUrl = getImageUrl(build.item.imageName ?? undefined);
  const formaCount = build.buildData.formaCount ?? 0;

  return (
    <Link
      href={`/builds/${build.slug}`}
      className="group flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      {/* Item image */}
      <div className="relative w-10 h-10 rounded bg-muted/50 shrink-0 overflow-hidden">
        <Image
          src={imageUrl}
          alt={build.item.name}
          fill
          className="object-cover transition-transform group-hover:scale-110"
          unoptimized
        />
      </div>

      {/* Build info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {build.name}
        </p>
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
    </Link>
  );
}

function DeletedPartnerCard() {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30 opacity-60">
      <div className="w-10 h-10 rounded bg-muted/50 shrink-0 flex items-center justify-center">
        <X className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Build no longer available</p>
    </div>
  );
}
