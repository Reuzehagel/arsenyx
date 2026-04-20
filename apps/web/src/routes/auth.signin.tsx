import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
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
      <main className="container flex flex-1 items-center justify-center py-12">
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
