"use client";

import { useEffect, useCallback } from "react";

interface UseBuildKeyboardOptions {
  onSelectSlot: (slotId: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onCopyBuild: () => void;
  onClearBuild: () => void;
  hasAuraSlot: boolean;
}

/**
 * Keyboard shortcuts for build editor:
 * - 1-8: Select normal slot
 * - A: Select aura slot (if warframe)
 * - E: Select exilus slot
 * - C: Copy build link
 * - X: Clear build
 * - Escape: Deselect slot / clear focus
 */
export function useBuildKeyboard({
  onSelectSlot,
  onOpenSearch,
  onCloseSearch,
  onCopyBuild,
  onClearBuild,
  hasAuraSlot,
}: UseBuildKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input (except for Escape)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        // Only handle Escape in inputs - deselect active slot
        if (e.key === "Escape") {
          e.preventDefault();
          onCloseSearch();
          (target as HTMLInputElement).blur();
        }
        return;
      }

      // Escape deselects the active slot
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseSearch();
        return;
      }

      // Number keys 1-8 for normal slots
      if (e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        const slotIndex = parseInt(e.key) - 1;
        onSelectSlot(`normal-${slotIndex}`);
        onOpenSearch();
        return;
      }

      // Letter shortcuts
      switch (e.key.toLowerCase()) {
        case "a":
          if (hasAuraSlot) {
            e.preventDefault();
            onSelectSlot("aura-0");
            onOpenSearch();
          }
          break;
        case "e":
          e.preventDefault();
          onSelectSlot("exilus-0");
          onOpenSearch();
          break;
        case "c":
          if (e.ctrlKey || e.metaKey) {
            // Let default copy behavior through
            return;
          }
          e.preventDefault();
          onCopyBuild();
          break;
        case "x":
          e.preventDefault();
          onClearBuild();
          break;
      }
    },
    [
      onSelectSlot,
      onOpenSearch,
      onCloseSearch,
      onCopyBuild,
      onClearBuild,
      hasAuraSlot,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
