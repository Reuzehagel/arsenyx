import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Icons } from "@/components/icons";
import { getPublicBuilds, type BuildWithUser } from "@/lib/db/index";
import { getImageUrl } from "@/lib/warframe/images";
import { Eye, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
    title: "Browse Builds | ARSENYX",
    description: "Discover and explore community Warframe builds.",
};

interface BuildsPageProps {
    searchParams: Promise<{
        category?: string;
        sort?: "newest" | "popular" | "updated";
        page?: string;
        q?: string;
        author?: string;
        hasGuide?: string;
        hasShards?: string;
    }>;
}

// Simple relative time formatting without date-fns
function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

/** Build a URLSearchParams string preserving all active filters */
function buildFilterUrl(
    overrides: Record<string, string | undefined>,
    current: {
        category?: string;
        sort: string;
        q?: string;
        author?: string;
        hasGuide?: string;
        hasShards?: string;
    }
) {
    const merged = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
    if (merged.q) params.set("q", merged.q);
    if (merged.author) params.set("author", merged.author);
    if (merged.hasGuide) params.set("hasGuide", merged.hasGuide);
    if (merged.hasShards) params.set("hasShards", merged.hasShards);
    // Never preserve page when changing filters
    if (overrides.page) params.set("page", overrides.page);
    const str = params.toString();
    return `/builds${str ? `?${str}` : ""}`;
}

function BuildCard({ build }: { build: BuildWithUser }) {
    const timeAgo = getRelativeTime(new Date(build.createdAt));

    return (
        <Link
            href={`/builds/${build.slug}`}
            className="block bg-card border rounded-lg overflow-hidden"
        >
            {/* Item Image */}
            <div className="relative aspect-video bg-muted/20">
                <Image
                    src={getImageUrl(build.item.imageName ?? undefined)}
                    alt={build.item.name}
                    fill
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                        {build.item.browseCategory}
                    </Badge>
                </div>
            </div>

            {/* Build Info */}
            <div className="p-3 flex flex-col gap-2">
                <div>
                    <h3 className="font-semibold text-sm line-clamp-1">
                        {build.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {build.item.name}
                    </p>
                </div>

                {/* Author and Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="line-clamp-1">
                        by {build.user.username || build.user.name || "Anonymous"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-0.5">
                            <ThumbsUp className="size-3" />
                            {build.voteCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                            <Eye className="size-3" />
                            {build.viewCount}
                        </span>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
        </Link>
    );
}

const CATEGORY_OPTIONS = [
    { value: "", label: "All Categories" },
    { value: "warframes", label: "Warframes" },
    { value: "primary", label: "Primary" },
    { value: "secondary", label: "Secondary" },
    { value: "melee", label: "Melee" },
    { value: "companions", label: "Companions" },
    { value: "archwing", label: "Archwing" },
    { value: "necramechs", label: "Necramechs" },
];

const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "votes", label: "Most Voted" },
    { value: "views", label: "Most Viewed" },
    { value: "updated", label: "Recently Updated" },
];

export default async function BuildsPage({ searchParams }: BuildsPageProps) {
    const params = await searchParams;
    const category = params.category || undefined;
    const sortBy = (params.sort as "newest" | "votes" | "views" | "updated") || "newest";
    const page = parseInt(params.page || "1", 10);
    const q = params.q || undefined;
    const author = params.author || undefined;
    const hasGuide = params.hasGuide === "true" ? true : undefined;
    const hasShards = params.hasShards === "true" ? true : undefined;
    const limit = 24;

    const filterState = {
        category,
        sort: sortBy,
        q,
        author,
        hasGuide: params.hasGuide,
        hasShards: params.hasShards,
    };

    const { builds, total } = await getPublicBuilds({
        category,
        sortBy,
        page,
        limit,
        query: q,
        author,
        hasGuide,
        hasShards,
    });

    const totalPages = Math.ceil(total / limit);
    const hasActiveFilters = !!(q || author || hasGuide || hasShards);

    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                <div className="container py-6 flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Community Builds</h1>
                            <p className="text-muted-foreground">
                                Discover builds created by the community
                            </p>
                        </div>
                        <Link href="/browse">
                            <Button variant="outline">Create Build</Button>
                        </Link>
                    </div>

                    {/* Search Bar */}
                    <form action="/builds" method="GET" className="flex gap-2">
                        <div className="relative flex-1">
                            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                name="q"
                                defaultValue={q}
                                placeholder="Search builds..."
                                className="pl-10"
                            />
                        </div>
                        {category && <input type="hidden" name="category" value={category} />}
                        {sortBy !== "newest" && <input type="hidden" name="sort" value={sortBy} />}
                        {author && <input type="hidden" name="author" value={author} />}
                        {hasGuide && <input type="hidden" name="hasGuide" value="true" />}
                        {hasShards && <input type="hidden" name="hasShards" value="true" />}
                        <Button type="submit">Search</Button>
                    </form>

                    {/* Filters */}
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                        {/* Category Filter */}
                        <Tabs value={category || ""} className="w-full xl:w-auto">
                            <TabsList className="h-auto p-1 flex-wrap justify-start bg-muted/50 w-full xl:w-auto">
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <TabsTrigger
                                        key={opt.value}
                                        value={opt.value}
                                        className="data-[state=active]:bg-background gap-2 flex-1 xl:flex-none"
                                        render={<Link href={buildFilterUrl({ category: opt.value || undefined }, filterState)} />}
                                        nativeButton={false}
                                    >
                                            {opt.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {/* Sort Options */}
                        <div className="flex items-center justify-end w-full xl:w-auto">
                            <Tabs value={sortBy} className="w-full xl:w-auto">
                                <TabsList className="w-full xl:w-auto bg-muted/50">
                                    {SORT_OPTIONS.map((opt) => (
                                        <TabsTrigger
                                            key={opt.value}
                                            value={opt.value}
                                            className="flex-1 xl:flex-none"
                                            render={<Link href={buildFilterUrl({ sort: opt.value }, filterState)} />}
                                            nativeButton={false}
                                        >
                                                {opt.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    {/* Active Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        {author && (
                            <Badge variant="secondary" className="gap-1">
                                Author: {author}
                                <Link href={buildFilterUrl({ author: undefined }, filterState)}>
                                    <span className="sr-only">Remove author filter</span>
                                    &times;
                                </Link>
                            </Badge>
                        )}
                        {hasGuide && (
                            <Badge variant="secondary" className="gap-1">
                                Has Guide
                                <Link href={buildFilterUrl({ hasGuide: undefined }, filterState)}>
                                    <span className="sr-only">Remove guide filter</span>
                                    &times;
                                </Link>
                            </Badge>
                        )}
                        {hasShards && (
                            <Badge variant="secondary" className="gap-1">
                                Has Shards
                                <Link href={buildFilterUrl({ hasShards: undefined }, filterState)}>
                                    <span className="sr-only">Remove shards filter</span>
                                    &times;
                                </Link>
                            </Badge>
                        )}
                        {!hasGuide && (
                            <Link href={buildFilterUrl({ hasGuide: "true" }, filterState)}>
                                <Button variant="outline" size="sm">Has Guide</Button>
                            </Link>
                        )}
                        {!hasShards && (
                            <Link href={buildFilterUrl({ hasShards: "true" }, filterState)}>
                                <Button variant="outline" size="sm">Has Shards</Button>
                            </Link>
                        )}
                        {hasActiveFilters && (
                            <Link href="/builds">
                                <Button variant="ghost" size="sm">Clear All</Button>
                            </Link>
                        )}
                    </div>

                    {/* Results */}
                    {builds.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground">No builds found.</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Be the first to{" "}
                                <Link href="/browse" className="text-primary underline">
                                    create a build
                                </Link>
                                !
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {builds.map((build) => (
                                    <BuildCard key={build.id} build={build} />
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2">
                                    {page > 1 && (
                                        <Link
                                            href={buildFilterUrl({ page: String(page - 1) }, filterState)}
                                        >
                                            <Button variant="outline" size="sm">
                                                Previous
                                            </Button>
                                        </Link>
                                    )}
                                    <span className="text-sm text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </span>
                                    {page < totalPages && (
                                        <Link
                                            href={buildFilterUrl({ page: String(page + 1) }, filterState)}
                                        >
                                            <Button variant="outline" size="sm">
                                                Next
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
