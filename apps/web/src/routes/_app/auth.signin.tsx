import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { pageSeo } from "@/lib/seo"
import { SITE_CONFIG } from "@/lib/util/constants"

type SignInSearch = { redirect?: string }

export const Route = createFileRoute("/_app/auth/signin")({
  head: () => pageSeo("/auth/signin"),
  component: SignInPage,
  // Same-origin paths only: it's appended to the origin for the OAuth
  // callbackURL, where `@host`, `.host` or `//host` would change the host.
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect:
      typeof search.redirect === "string" &&
      /^\/(?![/\\])/.test(search.redirect)
        ? search.redirect
        : undefined,
  }),
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && session) {
      navigate({ to: redirect ?? "/", replace: true })
    }
  }, [isPending, session, redirect, navigate])

  async function onGithub() {
    // Better Auth resolves callbackURL against the API baseURL, so pass an absolute web URL.
    const origin = window.location.origin
    await authClient.signIn.social({
      provider: "github",
      callbackURL: `${origin}${redirect ?? "/"}`,
      errorCallbackURL: `${origin}/auth/error`,
    })
  }

  return (
    <div className="wrap flex flex-1 items-center justify-center py-12">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border p-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Sign in to {SITE_CONFIG.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Use your GitHub account to continue.
          </p>
        </div>

        <Button
          onClick={onGithub}
          disabled={isPending || !!session}
          className="w-full"
        >
          <Icons.github data-icon="inline-start" />
          Continue with GitHub
        </Button>

        {import.meta.env.DEV ? <DevSignInForm redirect={redirect} /> : null}

        <p className="text-muted-foreground text-center text-xs">
          By signing in you agree to our{" "}
          <a href="/terms" className="underline underline-offset-4">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}

// Dev-only email+password form. Tree-shaken out of prod builds via
// `import.meta.env.DEV`. Paired with `just setup`, which seeds
// admin@local.dev with a random password printed to the terminal
// (re-run `just setup` to rotate it if lost).
function DevSignInForm({ redirect }: { redirect: string | undefined }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("admin@local.dev")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await authClient.signIn.email({ email, password })
    setBusy(false)
    if (err) {
      setError(err.message ?? "sign-in failed")
      return
    }
    navigate({ to: redirect ?? "/", replace: true })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs uppercase">
          dev login
        </span>
        <div className="bg-border h-px flex-1" />
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="dev-email">Email</FieldLabel>
            <Input
              id="dev-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@local.dev"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dev-password">Password</FieldLabel>
            <Input
              id="dev-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password from `just setup`"
            />
          </Field>
        </FieldGroup>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" variant="secondary" disabled={busy}>
          Sign in
        </Button>
      </form>
    </>
  )
}
