"use client";

import { useState, useCallback, useRef, useSyncExternalStore, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { copyBuildToClipboard } from "@/lib/build-codec";
import type { BuildState } from "@/lib/warframe/types";

interface UseBuildUIProps {
  savedBuildId?: string;
  readOnly: boolean;
  isOwner: boolean;
  buildState: BuildState;
}

interface UseBuildUIReturn {
  isAuthenticated: boolean;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  canEdit: boolean;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  showCopied: boolean;
  handleSelectSlot: (slotId: string) => void;
  handleCopyBuild: () => Promise<void>;
  hasMounted: boolean;
}

export function useBuildUI({
  savedBuildId,
  readOnly,
  isOwner,
  buildState,
}: UseBuildUIProps): UseBuildUIReturn {
  // Auth session
  const { data: session, isPending: isSessionPending } = useSession();

  // Track client-side mounting to avoid hydration mismatch with auth state
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Only consider authenticated after mount to prevent hydration mismatch
  const isAuthenticated = hasMounted && !isSessionPending && !!session?.user;

  // Track edit mode for owners (initially false = view mode)
  const [isEditMode, setIsEditMode] = useState(false);

  // canEdit: owners can edit when in edit mode, non-owners never
  // For new builds (no savedBuildId), always allow editing
  const canEdit = savedBuildId ? isOwner && isEditMode : !readOnly;

  // Active slot for mod placement
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Copy notification
  const [showCopied, setShowCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Select a slot for mod placement
  const handleSelectSlot = useCallback((slotId: string) => {
    setActiveSlotId(slotId);
  }, []);

  // Copy build to clipboard
  const handleCopyBuild = useCallback(async () => {
    const success = await copyBuildToClipboard(buildState);
    if (success) {
      setShowCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setShowCopied(false), 2000);
    }
  }, [buildState]);

  return {
    isAuthenticated,
    isEditMode,
    setIsEditMode,
    canEdit,
    activeSlotId,
    setActiveSlotId,
    showCopied,
    handleSelectSlot,
    handleCopyBuild,
    hasMounted,
  };
}
