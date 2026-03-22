import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserByUsername, getUserStats, getUserBuilds } from "@/lib/db/index";
import { BuildCardLink } from "@/components/build/build-card-link";
import { Calendar, Hammer } from "lucide-react";

export const revalidate = 3600; // 1 hour

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);

  if (!user) {
    return { title: "User Not Found | ARSENYX" };
  }

  const displayName = user.username || user.name || "User";

  return {
    title: `${displayName} | ARSENYX`,
    description:
      user.bio || `View ${displayName}'s Warframe builds on ARSENYX`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const user = await getUserByUsername(username);

  if (!user) {
    notFound();
  }

  const [stats, { builds }] = await Promise.all([
    getUserStats(user.id),
    getUserBuilds(user.id, undefined, { limit: 12, sortBy: "votes" }),
  ]);

  const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8 flex flex-col gap-8">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "User avatar"}
                  width={128}
                  height={128}
                  unoptimized
                  className="rounded-full"
                />
              ) : (
                <div className="size-32 rounded-full bg-muted flex items-center justify-center text-4xl font-bold">
                  {(user.username || user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">
                  {user.username || user.name || "Anonymous"}
                </h1>
                {user.role !== "USER" && (
                  <Badge variant="secondary">{user.role}</Badge>
                )}
              </div>

              {user.bio && (
                <p className="text-muted-foreground max-w-xl">{user.bio}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {joinDate}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-6 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalBuilds}</div>
                  <div className="text-xs text-muted-foreground">Builds</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {stats.totalVotesReceived}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Votes Received
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User's Builds */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Public Builds</h2>

            {builds.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Hammer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No public builds yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {builds.map((build) => (
                  <BuildCardLink
                    key={build.id}
                    slug={build.slug}
                    name={build.name}
                    itemName={build.item.name}
                    itemImageName={build.item.imageName}
                    voteCount={build.voteCount}
                    viewCount={build.viewCount}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
