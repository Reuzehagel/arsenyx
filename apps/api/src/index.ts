import { Hono } from "hono"
import { cors } from "hono/cors"

import { auth } from "./auth"
import { webOrigins } from "./env"
import { admin } from "./routes/admin"
import { builds } from "./routes/builds"
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

app.all("/auth/*", (c) => auth.handler(c.req.raw))

app.route("/admin", admin)
app.route("/builds", builds)
app.route("/imports", imports)
app.route("/me", me)
app.route("/orgs", orgs)
app.route("/users", users)

app.get("/health", (c) => c.json({ ok: true }))

export default {
  port: 8787,
  fetch: app.fetch,
}
