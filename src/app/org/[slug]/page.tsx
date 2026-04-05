import { Calendar, Settings, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BuildCardLink } from "@/components/build/build-card-link"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getServerSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getOrganizationBySlug } from "@/lib/db/organizations"

export const revalidate = 3600 // 1 hour

interface OrgProfilePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: OrgProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const org = await getOrganizationBySlug(slug)

  if (!org) {
    return { title: "Organization Not Found | ARSENYX" }
  }

  return {
    title: `${org.name} | ARSENYX`,
    description:
      org.description ?? `View ${org.name}'s Warframe builds on ARSENYX`,
  }
}

export default async function OrgProfilePage({ params }: OrgProfilePageProps) {
  const { slug } = await params
  const [org, session] = await Promise.all([
    getOrganizationBySlug(slug),
    getServerSession(),
  ])

  if (!org) {
    notFound()
  }

  const viewerUserId = session?.user?.id
  const isOrgMember = viewerUserId
    ? org.members.some((m) => m.userId === viewerUserId)
    : false

  const [builds, totalBuilds] = await Promise.all([
    prisma.build.findMany({
      where: { organizationId: org.id, visibility: "PUBLIC" },
      orderBy: { voteCount: "desc" },
      take: 12,
      select: {
        id: true,
        slug: true,
        name: true,
        itemName: true,
        itemImageName: true,
        voteCount: true,
        viewCount: true,
      },
    }),
    prisma.build.count({
      where: { organizationId: org.id, visibility: "PUBLIC" },
    }),
  ])

  const createdDate = new Date(org.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-8 py-8">
          {/* Org Header */}
          <div className="flex flex-col items-start gap-6 md:flex-row">
            {/* Avatar */}
            <div className="shrink-0">
              <Avatar className="size-32">
                <AvatarImage src={org.image ?? undefined} alt={org.name} />
                <AvatarFallback className="text-4xl font-bold">
                  {org.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Org Info */}
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold">{org.name}</h1>
                <span className="rounded bg-[#7c3aed] px-[5px] py-[1px] text-[9px] font-semibold text-white">
                  ORG
                </span>
                {isOrgMember && (
                  <Link
                    href={`/org/${org.slug}/settings`}
                    className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1.5 text-sm transition-colors"
                  >
                    <Settings className="size-4" />
                    Settings
                  </Link>
                )}
              </div>

              {org.description && (
                <p className="text-muted-foreground max-w-xl">
                  {org.description}
                </p>
              )}

              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  Created {createdDate}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-6 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalBuilds}</div>
                  <div className="text-muted-foreground text-xs">Builds</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{org.members.length}</div>
                  <div className="text-muted-foreground text-xs">Members</div>
                </div>
              </div>
            </div>
          </div>

          {/* Members */}
          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Users className="size-5" />
              Members
            </h2>
            <div className="flex flex-wrap gap-3">
              {org.members.map((member) => {
                const displayName =
                  member.user.displayUsername ??
                  member.user.username ??
                  member.user.name ??
                  "Unknown"
                const profileUsername =
                  member.user.username ?? member.user.name ?? ""

                return (
                  <Link
                    key={member.userId}
                    href={`/profile/${profileUsername}`}
                    className="bg-card hover:border-primary flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
                  >
                    <Avatar className="size-8">
                      <AvatarImage
                        src={member.user.image ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="text-sm font-medium">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{displayName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {member.role === "ADMIN" ? "Admin" : "Member"}
                    </Badge>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Builds */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Builds</h2>
            {builds.length === 0 ? (
              <p className="text-muted-foreground">No builds published yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {builds.map((build) => (
                  <BuildCardLink
                    key={build.id}
                    slug={build.slug}
                    name={build.name}
                    itemName={build.itemName}
                    itemImageName={build.itemImageName}
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
  )
}
