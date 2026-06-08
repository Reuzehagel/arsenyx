import { Hono } from "hono"
import { cors } from "hono/cors"

import { auth } from "./auth"
import { withPrisma } from "./db"
import { webOrigins } from "./env"
import { rateLimitAnonRead } from "./middleware/rate-limit"
import { banGuard, originGuard } from "./middleware/security"
import { isPrismaNotFound } from "./routes/_admin"
import { admin } from "./routes/admin"
import { builds } from "./routes/builds"
import { img } from "./routes/img"
import { imports } from "./routes/imports"
import { me } from "./routes/me"
import { orgs } from "./routes/orgs"
import { users } from "./routes/users"

const app = new Hono()

app.use(
  "*",
  cors({
    origin: webOrigins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
    maxAge: 600,
  }),
)

app.onError((err, c) => {
  if (isPrismaNotFound(err)) return c.json({ error: "not_found" }, 404)
  // Don't `console.error(err)` directly — for Prisma errors that drags in
  // `meta` (column names plus the parameter-bearing context from the
  // failing query) and dumps it into Workers logs verbatim. Keep just the
  // structured shape we actually need for triage; stack traces stay in
  // dev only since they can leak bundled paths / variable names.
  const e = err as Error & { code?: string }
  console.error("api error:", {
    name: e?.name,
    code: e?.code,
    method: c.req.method,
    path: c.req.path,
    message: e?.message,
    ...(process.env.NODE_ENV !== "production" ? { stack: e?.stack } : {}),
  })
  return c.json({ error: "internal_error" }, 500)
})

app.all("/auth/*", (c) => auth.handler(c.req.raw))

// Origin/ban guards on session-cookie routes only — Better Auth handles its
// own CSRF on /auth/*.
app.use("/builds/*", originGuard, banGuard)
app.use("/imports/*", originGuard, banGuard)
app.use("/me/*", originGuard, banGuard)
app.use("/orgs/*", originGuard, banGuard)
app.use("/users/*", originGuard, banGuard)
app.use("/admin/*", originGuard, banGuard)

// Edge-side anon throttle on the public read surfaces. Authenticated traffic
// short-circuits inside the middleware; signed-in users are still bound by
// rateLimitUser on mutations.
const anonRead = rateLimitAnonRead()
app.use("/builds/*", anonRead)
app.use("/orgs/*", anonRead)
app.use("/users/*", anonRead)
app.use("/img/*", anonRead)

app.route("/admin", admin)
app.route("/builds", builds)
app.route("/img", img)
app.route("/imports", imports)
app.route("/me", me)
app.route("/orgs", orgs)
app.route("/users", users)

app.get("/health", (c) => c.json({ ok: true }))

export default {
  port: 8787,
  fetch: (req: Request, env: unknown, ctx: ExecutionContext) =>
    withPrisma(ctx, () => app.fetch(req, env, ctx)),
}
