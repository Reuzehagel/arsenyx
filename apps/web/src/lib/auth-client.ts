import { usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { API_URL } from "@/lib/util/constants"

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [usernameClient()],
  // Better Auth refetches /auth/get-session on every tab refocus by default
  // (refetchOnWindowFocus). For our largely logged-out audience that call
  // always returns null — pure waste that fans out across the API Worker
  // whenever a build link is opened in a background tab and later focused.
  // Cross-tab login/logout still propagates via the broadcast channel (which
  // is independent of this flag), and the server already caps session
  // freshness at the 60s cookieCache (see apps/api/src/auth.ts), so on-focus
  // revalidation bought almost nothing. A long-lived signed-in tab now picks
  // up session changes on its next request/navigation instead of on refocus.
  sessionOptions: { refetchOnWindowFocus: false },
})
