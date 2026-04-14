import { Calendar } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { ProfileBuilds } from "@/components/profile"
import { Badge } from "@/components/ui/badge"
import { getServerSession } from "@/lib/auth"
import { getUserByUsername, getUserStats, getUserBuilds } from "@/lib/db/index"

export const revalidate = 3600 // 1 hour

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const user = await getUserByUsername(username)

  if (!user) {
    return { title: "User Not Found | ARSENYX" }
  }

  const displayName =
    user.displayUsername || user.username || user.name || "User"

  return {
    title: `${displayName} | ARSENYX`,
    description: user.bio || `View ${displayName}'s Warframe builds on ARSENYX`,
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const [user, session] = await Promise.all([
    getUserByUsername(username),
    getServerSession(),
  ])

  if (!user) {
    notFound()
  }

  const viewerId = session?.user?.id

  const [stats, { builds, total }] = await Promise.all([
    getUserStats(user.id),
    getUserBuilds(user.id, viewerId, { limit: 12, sortBy: "votes" }),
  ])
  const hasMore = total > 12

  const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-8 py-8">
          {/* Profile Header */}
          <div className="flex flex-col items-start gap-6 md:flex-row">
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
                <div className="bg-muted flex size-32 items-center justify-center rounded-full text-4xl font-bold">
                  {(user.username || user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-3xl font-bold">
                  {user.displayUsername ||
                    user.username ||
                    user.name ||
                    "Anonymous"}
                </h1>
                {user.isAdmin && <Badge variant="secondary">ADMIN</Badge>}
                {user.isModerator && (
                  <Badge variant="secondary">MODERATOR</Badge>
                )}
                {user.isVerified && <Badge variant="secondary">VERIFIED</Badge>}
                {user.isCommunityLeader && (
                  <Badge variant="secondary">COMMUNITY LEADER</Badge>
                )}
              </div>

              {user.bio && (
                <p className="text-muted-foreground max-w-xl">{user.bio}</p>
              )}

              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  Joined {joinDate}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-6 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalBuilds}</div>
                  <div className="text-muted-foreground text-xs">Builds</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {stats.totalVotesReceived}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Votes Received
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User's Builds */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Builds</h2>
            <ProfileBuilds
              userId={user.id}
              initialBuilds={builds}
              initialHasMore={hasMore}
            />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
