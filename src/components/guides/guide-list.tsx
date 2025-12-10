"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GuideCard } from "./guide-card";
import type { GuideListItem } from "@/lib/guides";

interface GuideListProps {
    initialGuides: GuideListItem[];
    allTags: string[];
    newGuideButton?: ReactNode;
}

export function GuideList({ initialGuides, allTags, newGuideButton }: GuideListProps) {
    const [search, setSearch] = useState("");

    // Filter guides by search
    const filteredGuides = useMemo(() => {
        if (!search) return initialGuides;

        const searchLower = search.toLowerCase();
        return initialGuides.filter(
            (g) =>
                g.title.toLowerCase().includes(searchLower) ||
                g.summary.toLowerCase().includes(searchLower) ||
                g.tags.some((t) => t.toLowerCase().includes(searchLower))
        );
    }, [initialGuides, search]);

    return (
        <div className="space-y-6">
            {/* Search Row - Full Width */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search guides..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {newGuideButton}
            </div>

            {/* Results info */}
            <div className="text-sm text-muted-foreground">
                {filteredGuides.length} {filteredGuides.length === 1 ? "guide" : "guides"}
                {search && ` matching "${search}"`}
            </div>

            {/* Guide Grid */}
            {filteredGuides.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredGuides.map((guide) => (
                        <GuideCard key={guide.id} guide={guide} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-4xl mb-4">📚</div>
                    <h3 className="text-lg font-medium mb-2">No guides found</h3>
                    <p className="text-muted-foreground max-w-sm">
                        {search
                            ? "Try adjusting your search terms."
                            : "Check back later for new guides!"}
                    </p>
                </div>
            )}
        </div>
    );
}
