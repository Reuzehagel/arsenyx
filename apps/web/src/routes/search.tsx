import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchBuilds } from "../api";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchBuilds(q),
    enabled: q.length > 0,
  });

  return (
    <div>
      <input
        autoFocus
        placeholder="search builds…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          background: "#111",
          border: "1px solid #333",
          borderRadius: 6,
          color: "#eee",
          fontSize: 16,
        }}
      />
      <div style={{ marginTop: 16, opacity: isFetching ? 0.5 : 1 }}>
        {data?.map((b) => (
          <Link
            key={b.id}
            to="/builds/$id"
            params={{ id: b.id }}
            style={{ display: "block", padding: 8, color: "inherit", textDecoration: "none", borderBottom: "1px solid #222" }}
          >
            {b.name} <span style={{ opacity: 0.5, fontSize: 13 }}>— {b.frame}</span>
          </Link>
        ))}
        {q && data && data.length === 0 && <p style={{ opacity: 0.5 }}>no matches</p>}
      </div>
    </div>
  );
}
