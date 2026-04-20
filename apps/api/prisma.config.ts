import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { defineConfig, env } from "prisma/config"

const rootDir = process.cwd()

for (const filename of [".env.local", ".env"]) {
  const fullPath = path.join(rootDir, filename)
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath })
  }
}

if (!process.env.DATABASE_URL) {
  const examplePath = path.join(rootDir, ".env.example")
  if (fs.existsSync(examplePath)) {
    dotenv.config({ path: examplePath })
  }
}

// `prisma generate` during install only needs a syntactically valid URL.
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/arsenyx"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
})
