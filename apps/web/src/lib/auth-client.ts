import { usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { API_URL } from "@/lib/constants"

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [usernameClient()],
})
