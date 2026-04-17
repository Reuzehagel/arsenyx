import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { OrgSettingsForm } from "@/components/org"
import { getServerSession } from "@/lib/auth"
import { getOrganizationBySlug, isOrgAdmin } from "@/lib/db/organizations"

interface OrgSettingsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Organization Settings | ARSENYX` }
}

export default async function OrgSettingsPage({
  params,
}: OrgSettingsPageProps) {
  const { slug } = await params
  const session = await getServerSession()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const org = await getOrganizationBySlug(slug)
  if (!org) {
    notFound()
  }

  const isAdmin = await isOrgAdmin(org.id, session.user.id)
  if (!isAdmin) {
    notFound()
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex max-w-2xl flex-col gap-8 py-8">
          <div>
            <h1 className="text-2xl font-bold">{org.name} Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your organization
            </p>
          </div>
          <OrgSettingsForm org={org} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
