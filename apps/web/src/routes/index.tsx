import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { fetchBuilds } from "../api";

const buildsQuery = queryOptions({
  queryKey: ["builds"],
  queryFn: fetchBuilds,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(buildsQuery),
  component: BuildsList,
});

function BuildsList() {
  return (
    <Suspense fallback={<p>loading…</p>}>
      <List />
    </Suspense>
  );
}

function List() {
  const { data } = useSuspenseQuery(buildsQuery);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
      {data.map((b) => (
        <Link
          key={b.id}
          to="/builds/$id"
          params={{ id: b.id }}
          style={{
            padding: 16,
            border: "1px solid #222",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
            background: "#111",
          }}
        >
          <div style={{ fontWeight: 600 }}>{b.name}</div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>{b.frame} · {b.votes} votes · @{b.author}</div>
        </Link>
      ))}
    </div>
  );
}
