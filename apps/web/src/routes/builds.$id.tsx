import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { fetchBuild } from "../api";

const buildQuery = (id: string) =>
  queryOptions({
    queryKey: ["build", id],
    queryFn: () => fetchBuild(id),
  });

export const Route = createFileRoute("/builds/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(buildQuery(params.id)),
  component: BuildPage,
});

function BuildPage() {
  const { id } = Route.useParams();
  return (
    <Suspense fallback={<p>loading…</p>}>
      <Detail id={id} />
    </Suspense>
  );
}

function Detail({ id }: { id: string }) {
  const { data } = useSuspenseQuery(buildQuery(id));
  return (
    <div>
      <Link to="/" style={{ color: "#888", fontSize: 13 }}>← back</Link>
      <h1 style={{ marginTop: 16 }}>{data.name}</h1>
      <p style={{ opacity: 0.7 }}>{data.frame} · {data.votes} votes · @{data.author}</p>
      <p>{data.description}</p>
      <h3>Mods</h3>
      <ul>
        {data.mods.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  );
}
