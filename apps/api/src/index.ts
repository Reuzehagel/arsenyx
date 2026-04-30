import { Hono } from "hono"
import { cors } from "hono/cors"

import { auth } from "./auth"
import { withPrisma } from "./db"
import { webOrigins } from "./env"
import { banGuard, originGuard } from "./middleware/security"
import { isPrismaNotFound } from "./routes/_admin"
import { admin } from "./routes/admin"
import { builds } from "./routes/builds"
import { imports } from "./routes/imports"
import { me } from "./routes/me"
import { orgs } from "./routes/orgs"
import { users } from "./routes/users"
import { v1 } from "./routes/v1"

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
  console.error(err)
  return c.json({ error: "internal_error" }, 500)
})

app.all("/auth/*", (c) => auth.handler(c.req.raw))

// Origin/ban guards on session-cookie routes only — Better Auth handles its
// own CSRF on /auth/*, and /api/v1 is the PAT-authed surface.
app.use("/builds/*", originGuard, banGuard)
app.use("/imports/*", originGuard, banGuard)
app.use("/me/*", originGuard, banGuard)
app.use("/orgs/*", originGuard, banGuard)
app.use("/users/*", originGuard, banGuard)
app.use("/admin/*", originGuard, banGuard)

app.route("/admin", admin)
app.route("/builds", builds)
app.route("/imports", imports)
app.route("/me", me)
app.route("/orgs", orgs)
app.route("/users", users)
app.route("/api/v1", v1)

app.get("/health", (c) => c.json({ ok: true }))

export default {
  port: 8787,
  fetch: (req: Request, env: unknown, ctx: ExecutionContext) =>
    withPrisma(ctx, () => app.fetch(req, env, ctx)),
}
