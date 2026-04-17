import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors({ origin: "http://localhost:5173", credentials: true }));

const builds = Array.from({ length: 40 }, (_, i) => ({
  id: `build-${i + 1}`,
  name: `Build ${i + 1}`,
  frame: ["Volt", "Saryn", "Mesa", "Mag", "Rhino"][i % 5],
  votes: Math.floor(Math.random() * 500),
  author: `user${(i % 7) + 1}`,
}));

app.get("/builds", (c) => c.json(builds));

app.get("/builds/:id", (c) => {
  const id = c.req.param("id");
  const build = builds.find((b) => b.id === id);
  if (!build) return c.json({ error: "not found" }, 404);
  return c.json({
    ...build,
    description: `A build for ${build.frame}. Fast, snappy, and client-rendered.`,
    mods: ["Primed Continuity", "Streamline", "Fleeting Expertise", "Transient Fortitude"],
  });
});

app.get("/search", (c) => {
  const q = c.req.query("q")?.toLowerCase() ?? "";
  return c.json(builds.filter((b) => b.name.toLowerCase().includes(q) || b.frame.toLowerCase().includes(q)));
});

export default {
  port: 8787,
  fetch: app.fetch,
};
