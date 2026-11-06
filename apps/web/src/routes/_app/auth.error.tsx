import { createFileRoute } from "@tanstack/react-router"

import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { pageSeo } from "@/lib/seo"

type ErrorSearch = { error?: string; error_description?: string }

export const Route = createFileRoute("/_app/auth/error")({
  head: () => pageSeo("/auth/error"),
  component: AuthErrorPage,
  validateSearch: (search: Record<string, unknown>): ErrorSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string"
        ? search.error_description
        : undefined,
  }),
})

const FRIENDLY: Record<string, string> = {
  access_denied: "You cancelled the sign-in flow.",
  server_error: "Something went wrong on our end. Please try again.",
  invalid_request: "The sign-in request was invalid.",
}

function AuthErrorPage() {
  const { error, error_description } = Route.useSearch()
  const message =
    error_description ?? (error && FRIENDLY[error]) ?? "Sign-in failed."

  return (
    <div className="wrap flex flex-1 items-center justify-center py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sign-in failed</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
        {error ? (
          <code className="bg-muted rounded px-2 py-1 text-xs">{error}</code>
        ) : null}
        <Button render={<Link href="/auth/signin" />} nativeButton={false}>
          Try again
        </Button>
      </div>
    </div>
  )
}
