import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { ROUTES, SITE_CONFIG } from "@/lib/constants"

type SignInSearch = { redirect?: string }

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && session) {
      navigate({ to: redirect ?? ROUTES.home, replace: true })
    }
  }, [isPending, session, redirect, navigate])

  async function onGithub() {
    // Better Auth resolves callbackURL against the API baseURL, so pass an absolute web URL.
    const origin = window.location.origin
    await authClient.signIn.social({
      provider: "github",
      callbackURL: `${origin}${redirect ?? ROUTES.home}`,
      errorCallbackURL: `${origin}${ROUTES.signInError}`,
    })
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap flex flex-1 items-center justify-center py-12">
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
            <a href={ROUTES.terms} className="underline underline-offset-4">
              Terms
            </a>{" "}
            and{" "}
            <a href={ROUTES.privacy} className="underline underline-offset-4">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Dev-only email+password form. Tree-shaken out of prod builds via
// `import.meta.env.DEV`. Paired with `just setup`, which seeds
// admin@admin.com / admin.
function DevSignInForm({ redirect }: { redirect: string | undefined }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("admin@admin.com")
  const [password, setPassword] = useState("admin")
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
    navigate({ to: redirect ?? ROUTES.home, replace: true })
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
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@admin.com"
        />
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="admin"
        />
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" variant="secondary" disabled={busy}>
          Sign in
        </Button>
      </form>
    </>
  )
}
