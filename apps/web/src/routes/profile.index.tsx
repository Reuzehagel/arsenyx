import { createFileRoute, redirect } from "@tanstack/react-router"

import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/profile/")({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    const user = session.data?.user as { username?: string | null } | undefined
    if (!user) {
      throw redirect({ to: "/auth/signin" })
    }
    if (!user.username) {
      throw redirect({ to: "/" })
    }
    throw redirect({
      to: "/profile/$username",
      params: { username: user.username },
    })
  },
  component: () => null,
})
