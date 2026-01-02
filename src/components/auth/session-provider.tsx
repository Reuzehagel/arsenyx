"use client";

// Better Auth uses its own session handling via useSession hook
// This component is kept for compatibility but is now a simple passthrough
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
