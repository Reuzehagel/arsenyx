import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 32, borderBottom: "1px solid #333", paddingBottom: 16 }}>
        <Link to="/" style={linkStyle} activeProps={{ style: activeStyle }}>builds</Link>
        <Link to="/search" style={linkStyle} activeProps={{ style: activeStyle }}>search</Link>
        <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: 12 }}>arsenyx spike</span>
      </nav>
      <Outlet />
    </div>
  );
}

const linkStyle = { color: "#aaa", textDecoration: "none" };
const activeStyle = { color: "#fff", fontWeight: 600 };
