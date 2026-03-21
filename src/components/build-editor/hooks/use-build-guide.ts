"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserBuildsForPartnerSelectorAction } from "@/app/actions/builds";
import { GUIDE_STORAGE_KEY_PREFIX } from "./use-build-persistence";

interface PartnerBuild {
  id: string;
  slug: string;
  name: string;
  item: { name: string; imageName: string | null; browseCategory: string };
  buildData: { formaCount: number };
}

interface UseBuildGuideProps {
  itemUniqueName: string;
  savedBuildId?: string;
  isOwner: boolean;
  isAuthenticated: boolean;
  canEdit: boolean;
  initialGuide?: {
    summary?: string | null;
    description?: string | null;
    updatedAt?: Date;
  };
  initialPartnerBuilds?: PartnerBuild[];
}

interface UseBuildGuideReturn {
  guideSummary: string;
  setGuideSummary: (v: string) => void;
  guideDescription: string;
  setGuideDescription: (v: string) => void;
  partnerBuilds: PartnerBuild[];
  availableBuilds: PartnerBuild[];
  handleAddPartner: (buildId: string) => void;
  handleRemovePartner: (buildId: string) => void;
}

export function useBuildGuide({
  itemUniqueName,
  savedBuildId,
  isOwner,
  isAuthenticated,
  canEdit,
  initialGuide,
  initialPartnerBuilds = [],
}: UseBuildGuideProps): UseBuildGuideReturn {
  // Load guide from localStorage on init (for new builds only)
  const [guideSummary, setGuideSummary] = useState<string>(() => {
    if (initialGuide?.summary) return initialGuide.summary;
    if (savedBuildId) return "";
    try {
      const saved = localStorage.getItem(`${GUIDE_STORAGE_KEY_PREFIX}${itemUniqueName}`);
      if (saved) return JSON.parse(saved).summary || "";
    } catch { /* ignore */ }
    return "";
  });
  const [guideDescription, setGuideDescription] = useState<string>(() => {
    if (initialGuide?.description) return initialGuide.description;
    if (savedBuildId) return "";
    try {
      const saved = localStorage.getItem(`${GUIDE_STORAGE_KEY_PREFIX}${itemUniqueName}`);
      if (saved) return JSON.parse(saved).description || "";
    } catch { /* ignore */ }
    return "";
  });
  const [partnerBuilds, setPartnerBuilds] =
    useState<PartnerBuild[]>(initialPartnerBuilds);
  const [availableBuilds, setAvailableBuilds] = useState<PartnerBuild[]>([]);

  // Auto-save guide to localStorage
  useEffect(() => {
    if (!canEdit) return;

    const key = `${GUIDE_STORAGE_KEY_PREFIX}${itemUniqueName}`;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            summary: guideSummary,
            description: guideDescription,
          })
        );
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [guideSummary, guideDescription, itemUniqueName, canEdit]);

  // Fetch available builds for partner selector
  useEffect(() => {
    // For existing builds: only fetch when owner
    // For new builds: fetch when authenticated
    if (savedBuildId && !isOwner) return;
    if (!savedBuildId && !isAuthenticated) return;

    getUserBuildsForPartnerSelectorAction().then((result) => {
      if (result.success && result.data) {
        setAvailableBuilds(result.data);
      }
    });
  }, [isOwner, savedBuildId, isAuthenticated]);

  const handleAddPartner = useCallback(
    (buildId: string) => {
      const build = availableBuilds.find((b) => b.id === buildId);
      if (build) {
        setPartnerBuilds((prev) => [
          ...prev,
          {
            id: build.id,
            slug: build.slug,
            name: build.name,
            item: build.item,
            buildData: { formaCount: build.buildData.formaCount },
          },
        ]);
      }
    },
    [availableBuilds]
  );

  const handleRemovePartner = useCallback((buildId: string) => {
    setPartnerBuilds((prev) => prev.filter((b) => b.id !== buildId));
  }, []);

  return {
    guideSummary,
    setGuideSummary,
    guideDescription,
    setGuideDescription,
    partnerBuilds,
    availableBuilds,
    handleAddPartner,
    handleRemovePartner,
  };
}
