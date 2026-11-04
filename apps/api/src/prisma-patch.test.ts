import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

// patches/@prisma%2Fclient@<ver>.patch makes every per-request PrismaClient
// reuse the isolate's query compiler, query-plan cache and parameterization
// graph (~20% of a cache miss's CPU). Bun skips a patchedDependencies entry
// whose version no longer matches, so a Prisma bump drops the patch silently:
// this fails instead. Regenerate the patch for the new version (docs/commands.md).
describe("@prisma/client shared-compiler patch", () => {
  it("is applied to the runtime wrangler bundles", () => {
    const runtime = createRequire(import.meta.url).resolve(
      "@prisma/client/runtime/wasm-compiler-edge",
    )
    // createRequire resolves the "require" (.js) condition; workerd imports .mjs.
    const src = readFileSync(runtime.replace(/\.js$/, ".mjs"), "utf8")
    expect(src).toContain("__prismaShared(this.datamodel)")
    expect(src).toContain("e.queryCompiler.__shared||e.queryCompiler.free()")
    expect(src).toContain(".paramGraph??=Dr.deserialize(")
  })
})
