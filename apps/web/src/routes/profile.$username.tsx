import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Crown, Shield, ShieldCheck } from "lucide-react";
import { Suspense } from "react";

import {
  BuildsListView,
  nextBuildsListSearch,
  parseBuildsListSearch,
  type BuildsListSearch,
} from "@/components/builds/builds-list-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { type BuildListSort } from "@/lib/builds-list-query";
import {
  profileBuildsQuery,
  profileQuery,
  type Profile,
} from "@/lib/profile-query";
import { type BrowseCategory } from "@/lib/warframe";

type ProfileSearch = {
  page?: number;
  sort?: BuildListSort;
  q?: string;
  category?: BrowseCategory;
  hasGuide?: boolean;
  hasShards?: boolean;
};

export const Route = createFileRoute("/profile/$username")({
  validateSearch: (search): ProfileSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    sort: search.sort ?? "newest",
    q: search.q ?? "",
    category: search.category,
    hasGuide: search.hasGuide ?? false,
    hasShards: search.hasShards ?? false,
  }),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(profileQuery(params.username)),
      context.queryClient.ensureQueryData(
        profileBuildsQuery(params.username, deps),
      ),
    ]);
  },
  component: ProfilePage,
  notFoundComponent: ProfileNotFound,
});

function ProfilePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading profile…</p>}
          >
            <ProfileContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ProfileContent() {
  const { username } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const sort = search.sort ?? "newest";
  const q = search.q ?? "";
  const category = search.category;
  const hasGuide = search.hasGuide === true;
  const hasShards = search.hasShards === true;

  const { data: profile } = useSuspenseQuery(profileQuery(username));

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true });

  return (
    <>
      <ProfileHeader profile={profile} />
      <Suspense
        fallback={<p className="text-muted-foreground">Loading builds…</p>}
      >
        <BuildsListView
          title="Public builds"
          description={`Builds shared by ${profile.displayUsername ?? profile.username ?? "this user"}.`}
          query={profileBuildsQuery(username, {
            page,
            sort,
            q,
            category,
            hasGuide: hasGuide || undefined,
            hasShards: hasShards || undefined,
          })}
          page={page}
          sort={sort}
          q={q}
          category={category}
          hasGuide={hasGuide}
          hasShards={hasShards}
          onUpdateSearch={onUpdateSearch}
          showFilters
          emptyState={
            <p className="text-muted-foreground">No public builds yet.</p>
          }
        />
      </Suspense>
    </>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const display =
    profile.displayUsername ?? profile.username ?? profile.name ?? "User";
  const handle = profile.username ? `@${profile.username}` : null;
  const initial = display.charAt(0).toUpperCase();
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
      <div className="bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-medium">
        {profile.image ? (
          <img
            src={profile.image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {display}
          </h1>
          <ProfileBadges badges={profile.badges} />
        </div>
        {handle ? (
          <span className="text-muted-foreground text-sm">{handle}</span>
        ) : null}
        {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}
        <span className="text-muted-foreground text-xs">Joined {joined}</span>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
          <Stat label="Builds" value={profile.stats.buildCount} />
          <Stat label="Votes" value={profile.stats.totalVotes} />
          <Stat label="Favorites" value={profile.stats.totalFavorites} />
          <Stat label="Views" value={profile.stats.totalViews} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="text-foreground font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>{" "}
      {label}
    </span>
  );
}

function ProfileBadges({ badges }: { badges: Profile["badges"] }) {
  const items: { label: string; icon: typeof Shield; className: string }[] = [];
  if (badges.admin) {
    items.push({
      label: "Admin",
      icon: Shield,
      className: "bg-red-500/15 text-red-500",
    });
  }
  if (badges.moderator) {
    items.push({
      label: "Moderator",
      icon: ShieldCheck,
      className: "bg-blue-500/15 text-blue-500",
    });
  }
  if (badges.communityLeader) {
    items.push({
      label: "Community Leader",
      icon: Crown,
      className: "bg-amber-500/15 text-amber-500",
    });
  }
  if (badges.verified) {
    items.push({
      label: "Verified",
      icon: CheckCircle2,
      className: "bg-emerald-500/15 text-emerald-500",
    });
  }
  if (items.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((b) => (
        <Badge
          key={b.label}
          variant="secondary"
          className={`${b.className} gap-1 px-2 py-0.5 text-xs`}
        >
          <b.icon className="size-3" />
          {b.label}
        </Badge>
      ))}
    </span>
  );
}

function ProfileNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">User not found</h1>
        <p className="text-muted-foreground">
          This profile may not exist or has been deleted.
        </p>
      </main>
      <Footer />
    </div>
  );
}
