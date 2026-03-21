import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/lib/auth";
import { getUserBuilds } from "@/lib/db/index";
import { getImageUrl } from "@/lib/warframe/images";
import {
  ThumbsUp,
  Eye,
  Lock,
  Globe,
  Link as LinkIcon,
  Plus,
  Hammer,
} from "lucide-react";

export const metadata: Metadata = {
  title: "My Builds | ARSENYX",
  description: "Manage your saved Warframe builds",
};

interface MyBuildsPageProps {
  searchParams: Promise<{
    page?: string;
    sort?: string;
  }>;
}

export default async function MyBuildsPage({
  searchParams,
}: MyBuildsPageProps) {
  const [session, params] = await Promise.all([
    getServerSession(),
    searchParams,
  ]);

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/builds/mine");
  }

  const page = parseInt(params.page || "1", 10);
  const sortBy =
    (params.sort as "newest" | "votes" | "updated" | "views") || "newest";

  const { builds, total } = await getUserBuilds(
    session.user.id,
    session.user.id, // Viewing own builds - shows all including PRIVATE
    { page, limit: 24, sortBy }
  );

  const totalPages = Math.ceil(total / 24);

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "PRIVATE":
        return <Lock className="h-3 w-3" />;
      case "UNLISTED":
        return <LinkIcon className="h-3 w-3" />;
      default:
        return <Globe className="h-3 w-3" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case "PRIVATE":
        return "Private";
      case "UNLISTED":
        return "Unlisted";
      default:
        return "Public";
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Builds</h1>
              <p className="text-muted-foreground">
                {total} build{total !== 1 ? "s" : ""}
              </p>
            </div>
            <Button asChild>
              <Link href="/browse">
                <Plus className="h-4 w-4 mr-2" />
                New Build
              </Link>
            </Button>
          </div>

          {/* Sort options */}
          <div className="flex gap-2">
            {(
              [
                { value: "newest", label: "Newest" },
                { value: "updated", label: "Updated" },
                { value: "votes", label: "Most Voted" },
                { value: "views", label: "Most Viewed" },
              ] as const
            ).map((option) => (
              <Link
                key={option.value}
                href={`/builds/mine?sort=${option.value}&page=1`}
              >
                <Button
                  variant={sortBy === option.value ? "secondary" : "ghost"}
                  size="sm"
                >
                  {option.label}
                </Button>
              </Link>
            ))}
          </div>

          {builds.length === 0 ? (
            <div className="text-center py-16">
              <Hammer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                You haven&apos;t created any builds yet.
              </p>
              <Button asChild>
                <Link href="/browse">Create your first build</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {builds.map((build) => (
                  <Link
                    key={build.id}
                    href={`/builds/${build.slug}`}
                    className="block bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors"
                  >
                    <div className="relative aspect-video bg-muted/20">
                      <Image
                        src={getImageUrl(build.item.imageName ?? undefined)}
                        alt={build.item.name}
                        fill
                        className="object-cover"
                      />
                      {/* Visibility indicator */}
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs px-1.5 py-0.5"
                        >
                          {getVisibilityIcon(build.visibility)}
                          <span className="hidden sm:inline">
                            {getVisibilityLabel(build.visibility)}
                          </span>
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <h3 className="font-medium text-sm line-clamp-1">
                        {build.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {build.item.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <ThumbsUp className="h-3 w-3" />
                          {build.voteCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          {build.viewCount}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link href={`/builds/mine?page=${page - 1}&sort=${sortBy}`}>
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link href={`/builds/mine?page=${page + 1}&sort=${sortBy}`}>
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
