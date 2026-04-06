import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins"
import { headers } from "next/headers"

import { prisma } from "@/lib/db"

const githubId = process.env.GITHUB_ID?.trim()
const githubSecret = process.env.GITHUB_SECRET?.trim()

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders:
    githubId && githubSecret
      ? {
          github: {
            clientId: githubId,
            clientSecret: githubSecret,
          },
        }
      : {},
  plugins: [
    username(),
    nextCookies(), // Must be last plugin
  ],
  user: {
    additionalFields: {
      isVerified: {
        type: "boolean",
        defaultValue: false,
      },
      isCommunityLeader: {
        type: "boolean",
        defaultValue: false,
      },
      isModerator: {
        type: "boolean",
        defaultValue: false,
      },
      isAdmin: {
        type: "boolean",
        defaultValue: false,
      },
      isBanned: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  trustedOrigins: ["https://arsenyx.com", "https://www.arsenyx.com"],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
})

/** Get the current session from request headers (server-only) */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() })
}
