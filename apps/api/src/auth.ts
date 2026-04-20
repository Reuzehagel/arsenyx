import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { username } from "better-auth/plugins"

import { prisma } from "./db"
import { webOrigins } from "./env"

const githubId = process.env.GITHUB_CLIENT_ID?.trim()
const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim()

export const auth = betterAuth({
  appName: "Arsenyx",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  basePath: "/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: webOrigins,
  socialProviders:
    githubId && githubSecret
      ? {
          github: {
            clientId: githubId,
            clientSecret: githubSecret,
            mapProfileToUser: (profile) => ({
              username: profile.login.toLowerCase(),
              displayUsername: profile.login,
            }),
          },
        }
      : {},
  plugins: [username()],
  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      isVerified: { type: "boolean", defaultValue: false },
      isCommunityLeader: { type: "boolean", defaultValue: false },
      isModerator: { type: "boolean", defaultValue: false },
      isAdmin: { type: "boolean", defaultValue: false },
      isBanned: { type: "boolean", defaultValue: false },
      defaultBuildVisibility: { type: "string", defaultValue: "PUBLIC" },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    // Host-only cookies on api.arsenyx.com — web clients call /auth/get-session
    // cross-origin with credentials:include; no need for Domain=.arsenyx.com.
    crossSubDomainCookies: { enabled: false },
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
})
