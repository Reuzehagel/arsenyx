"use client";

import { useEffect, useRef } from "react";
import { incrementViewCountAction } from "@/app/actions/builds";

interface ViewTrackerProps {
    buildId: string;
}

export function ViewTracker({ buildId }: ViewTrackerProps) {
    const attemptedRef = useRef(false);

    useEffect(() => {
        // Prevent double-firing in Strict Mode
        if (attemptedRef.current) return;
        attemptedRef.current = true;

        const storageKey = `arsenix_viewed_${buildId}`;

        // Check if already viewed this session
        if (sessionStorage.getItem(storageKey)) {
            return;
        }

        // Mark as viewed and increment
        sessionStorage.setItem(storageKey, "true");
        incrementViewCountAction(buildId);
    }, [buildId]);

    return null;
}
