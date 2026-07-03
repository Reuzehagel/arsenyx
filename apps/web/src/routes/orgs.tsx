import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { Pagination } from "@/components/pagination"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { orgsDirectoryQuery } from "@/lib/queries/org-query"
import { seo } from "@/lib/seo"

type OrgsSearch = { page?: number }

export const Route = createFileRoute("/orgs")({
  head: () =>
    seo({
      title: "Organizations",
      description:
        "Warframe clans and communities publishing builds together on Arsenyx.",
      canonicalPath: "/orgs",
    }),
  validateSearch: (search): OrgsSearch => {
    const raw = (search as { page?: unknown }).page
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10)
    return Number.isFinite(n) && n > 1 ? { page: n } : {}
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(orgsDirectoryQuery(deps.page)),
  component: OrgsDirectoryPage,
})

function OrgsDirectoryPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex max-w-5xl flex-col gap-8 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
            <p className="text-muted-foreground text-sm">
              Communities on Arsenyx. Browse their public builds — joining is
              invite-only.
            </p>
          </div>
          <Suspense
            fallback={
              <p className="text-muted-foreground text-sm">
                Loading organizations…
              </p>
            }
          >
            <OrgsDirectoryContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function OrgsDirectoryContent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1
  const { data } = useSuspenseQuery(orgsDirectoryQuery(page))
  const { orgs, total, limit } = data

  const goto = (next: number) =>
    navigate({
      search: next > 1 ? { page: next } : {},
      replace: false,
    })

  if (orgs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No organizations yet. Be the first to create one.
      </p>
    )
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <li key={org.id}>
            <Link
              href={`/org/${org.slug}`}
              className="focus-visible:ring-ring block h-full rounded-xl focus:outline-none focus-visible:ring-2"
            >
              <Card className="hover:bg-muted/30 h-full transition-colors">
                <CardHeader className="flex flex-row items-center gap-3">
                  <UserAvatar
                    src={org.image}
                    fallback={org.name}
                    size={10}
                    shape="square"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle
                      className={`truncate ${org.verified ? "text-wf-org" : ""}`}
                      title={org.verified ? "Verified organization" : undefined}
                    >
                      {org.name}
                    </CardTitle>
                    <CardDescription className="truncate text-xs">
                      @{org.slug}
                    </CardDescription>
                  </div>
                </CardHeader>
                {org.description ? (
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3 text-sm">
                      {org.description}
                    </p>
                  </CardContent>
                ) : null}
                {/* mt-auto pins the stats row to the card bottom so rows align
                    across cards with and without a description. */}
                <CardFooter className="text-muted-foreground mt-auto justify-between text-xs">
                  <span>
                    <span className="text-foreground font-semibold tabular-nums">
                      {org.memberCount.toLocaleString()}
                    </span>{" "}
                    {org.memberCount === 1 ? "member" : "members"}
                  </span>
                  <span>
                    <span className="text-foreground font-semibold tabular-nums">
                      {org.buildCount.toLocaleString()}
                    </span>{" "}
                    {org.buildCount === 1 ? "build" : "builds"}
                  </span>
                </CardFooter>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={total}
        limit={limit}
        onPage={goto}
        href={(p) => (p > 1 ? `/orgs?page=${p}` : "/orgs")}
      />
    </>
  )
}
