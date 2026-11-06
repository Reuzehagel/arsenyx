import { createFileRoute, redirect } from "@tanstack/react-router"

import { requireUser } from "@/lib/auth-guards"

export const Route = createFileRoute("/_app/profile/")({
  beforeLoad: async () => {
    const user = await requireUser()
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
