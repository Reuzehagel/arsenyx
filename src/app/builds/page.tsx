import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getPublicBuilds, type BuildWithUser } from "@/lib/db/index";
import { getImageUrl } from "@/lib/warframe/images";
import { Eye, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
    title: "Browse Builds | ARSENIX",
    description: "Discover and explore community Warframe builds.",
};

interface BuildsPageProps {
    searchParams: Promise<{
        category?: string;
        sort?: "newest" | "popular" | "updated";
        page?: string;
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
            <div className="p-3 space-y-2">
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
                            <ThumbsUp className="w-3 h-3" />
                            {build.voteCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                            <Eye className="w-3 h-3" />
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
    { value: "popular", label: "Most Popular" },
    { value: "updated", label: "Recently Updated" },
];

export default async function BuildsPage({ searchParams }: BuildsPageProps) {
    const params = await searchParams;
    const category = params.category || undefined;
    const sortBy = (params.sort as "newest" | "popular" | "updated") || "newest";
    const page = parseInt(params.page || "1", 10);
    const limit = 24;

    const { builds, total } = await getPublicBuilds({
        category,
        sortBy,
        page,
        limit,
    });

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                <div className="container py-6 space-y-6">
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

                    {/* Filters */}
                    <div className="flex flex-col gap-6">
                        {/* Category Filter */}
                        <Tabs value={category || ""} className="w-full">
                            <TabsList className="h-auto p-1 flex-wrap justify-start bg-muted/50">
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <TabsTrigger
                                        key={opt.value}
                                        value={opt.value}
                                        asChild
                                        className="data-[state=active]:bg-background gap-2"
                                    >
                                        <Link
                                            href={`/builds?${new URLSearchParams({
                                                ...(opt.value && { category: opt.value }),
                                                sort: sortBy,
                                            }).toString()}`}
                                        >
                                            {opt.label}
                                        </Link>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {/* Sort Options */}
                        <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-muted-foreground">Sort:</span>
                            {SORT_OPTIONS.map((opt) => (
                                <Link
                                    key={opt.value}
                                    href={`/builds?${new URLSearchParams({
                                        ...(category && { category }),
                                        sort: opt.value,
                                    }).toString()}`}
                                >
                                    <Badge
                                        variant={sortBy === opt.value ? "default" : "outline"}
                                        className="cursor-pointer"
                                    >
                                        {opt.label}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
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
                                            href={`/builds?${new URLSearchParams({
                                                ...(category && { category }),
                                                sort: sortBy,
                                                page: String(page - 1),
                                            }).toString()}`}
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
                                            href={`/builds?${new URLSearchParams({
                                                ...(category && { category }),
                                                sort: sortBy,
                                                page: String(page + 1),
                                            }).toString()}`}
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
