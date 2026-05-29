import { redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/auth-client"

/** Resolve the current session user, or throw a redirect to sign-in. Use in a
 *  route `beforeLoad` to gate authenticated pages. */
export async function requireUser() {
  const session = await authClient.getSession()
  const user = session.data?.user
  if (!user) {
    throw redirect({ to: "/auth/signin" })
  }
  return user
}

/** Resolve the current session user and assert admin, or throw a redirect to
 *  the home page. Mirrors the admin route's gate (non-admins go to "/"). */
export async function requireAdmin() {
  const session = await authClient.getSession()
  const user = session.data?.user as { isAdmin?: boolean } | undefined
  if (!user || user.isAdmin !== true) {
    throw redirect({ to: "/" })
  }
  return user
}
