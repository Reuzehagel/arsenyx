import { Hono } from "hono"

import { env } from "./env.ts"
import { invalidateRoute } from "./routes/invalidate.ts"
import { screenshotRoute } from "./routes/screenshot.ts"

const app = new Hono()

app.get("/health", (c) => c.json({ ok: true }))
app.route("/", screenshotRoute)
app.route("/", invalidateRoute)

export default {
  port: env.PORT,
  fetch: app.fetch,
}
