import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveBuildAction } from "@/app/actions/builds";
import { copyBuildToClipboard } from "@/lib/build-codec";
import type { BrowseCategory } from "@/lib/warframe/types";
import type { BuildState } from "@/lib/warframe/types";
import type { BrowseableItem } from "@/lib/warframe/types";
import type { Visibility } from "../publish-dialog";

export const STORAGE_KEY_PREFIX = "arsenyx_build_";
export const GUIDE_STORAGE_KEY_PREFIX = "arsenyx_build_guide_";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseBuildPersistenceProps {
  item: BrowseableItem;
  category: BrowseCategory;
  buildState: BuildState;
  hydrateBuildState: (partial: Partial<BuildState>) => void;
  savedBuildId?: string;
  importedBuild?: Partial<BuildState>;
  isAuthenticated: boolean;
  canEdit: boolean;
  guideSummary: string;
  guideDescription: string;
  partnerBuildIds: string[];
  setIsEditMode: (v: boolean) => void;
}

interface UseBuildPersistenceReturn {
  buildId: string | undefined;
  buildName: string;
  setBuildName: (name: string) => void;
  saveStatus: SaveStatus;
  publishDialogOpen: boolean;
  setPublishDialogOpen: (open: boolean) => void;
  handlePublish: (visibility: Visibility) => Promise<void>;
  handleCancel: () => void;
}

export function useBuildPersistence({
  item,
  category,
  buildState,
  hydrateBuildState,
  savedBuildId,
  importedBuild,
  isAuthenticated,
  canEdit,
  guideSummary,
  guideDescription,
  partnerBuildIds,
  setIsEditMode,
}: UseBuildPersistenceProps): UseBuildPersistenceReturn {
  const router = useRouter();

  const [buildId, setBuildId] = useState<string | undefined>(savedBuildId);
  const [buildName, setBuildName] = useState<string>(
    importedBuild?.buildName || `${item.name} Build`
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Auto-save buildState to localStorage (debounced 300ms)
  useEffect(() => {
    if (!canEdit) return;

    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(buildState));
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [buildState, item.uniqueName, canEdit]);

  // Load buildState from localStorage on mount
  useEffect(() => {
    if (importedBuild) return;

    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        hydrateBuildState({
          ...parsed,
          itemUniqueName: item.uniqueName,
          itemName: item.name,
          itemCategory: category,
          itemImageName: item.imageName,
        });
      }
    } catch {
      // Ignore parse errors
    }
  }, [item.uniqueName, item.name, item.imageName, category, importedBuild, hydrateBuildState]);

  const handlePublish = useCallback(
    async (visibility: Visibility) => {
      if (isAuthenticated) {
        const isUpdating = !!buildId;

        setSaveStatus("saving");

        try {
          const result = await saveBuildAction({
            buildId: buildId,
            itemUniqueName: item.uniqueName,
            name: buildName,
            visibility: visibility,
            buildData: { ...buildState, buildName },
            guideSummary: guideSummary.trim() || undefined,
            guideDescription: guideDescription.trim() || undefined,
            partnerBuildIds,
          });

          if (!result.success) {
            setSaveStatus("error");
            window.setTimeout(() => setSaveStatus("idle"), 3000);
          } else {
            setBuildId(result.data.id);
            setSaveStatus("saved");
            setPublishDialogOpen(false);

            try {
              localStorage.removeItem(
                `${STORAGE_KEY_PREFIX}${item.uniqueName}`
              );
              localStorage.removeItem(
                `${GUIDE_STORAGE_KEY_PREFIX}${item.uniqueName}`
              );
            } catch {
              // Ignore storage errors
            }

            if (isUpdating) {
              setIsEditMode(false);
            } else {
              router.push(`/builds/${result.data.slug}`);
            }
          }
        } catch (error) {
          console.error("Save build error:", error);
          setSaveStatus("error");
          window.setTimeout(() => setSaveStatus("idle"), 3000);
        }
        return;
      }

      const success = await copyBuildToClipboard(buildState);
      if (success) {
        setPublishDialogOpen(false);
      }
    },
    [
      isAuthenticated,
      buildId,
      item.uniqueName,
      buildName,
      buildState,
      router,
      guideSummary,
      guideDescription,
      partnerBuildIds,
      setIsEditMode,
    ]
  );

  const handleCancel = useCallback(() => {
    const buildKey = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const guideKey = `${GUIDE_STORAGE_KEY_PREFIX}${item.uniqueName}`;
    try {
      localStorage.removeItem(buildKey);
      localStorage.removeItem(guideKey);
    } catch {
      // Ignore storage errors
    }

    if (savedBuildId) {
      setIsEditMode(false);
    } else {
      router.back();
    }
  }, [item.uniqueName, router, savedBuildId, setIsEditMode]);

  return {
    buildId,
    buildName,
    setBuildName,
    saveStatus,
    publishDialogOpen,
    setPublishDialogOpen,
    handlePublish,
    handleCancel,
  };
}
