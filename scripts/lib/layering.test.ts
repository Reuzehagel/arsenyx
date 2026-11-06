import { describe, expect, test } from "bun:test"

import { findLayerViolations } from "./layering"

const lines = (file: string, src: string) =>
  findLayerViolations(file, src).map((v) => v.line)

describe("findLayerViolations", () => {
  test("flags web lib importing a component via the @/ alias", () => {
    const src = `import { a } from "@/lib/util/utils"\nimport type { X } from "@/components/build-editor/mod-card"\n`
    expect(lines("apps/web/src/lib/codec/x.ts", src)).toEqual([2])
  })

  test("flags a relative import that climbs into a forbidden folder", () => {
    const src = `import { y } from "../build-editor/editor-shell"`
    expect(lines("apps/web/src/components/build-loadout/x.tsx", src)).toEqual([
      1,
    ])
  })

  test("flags shared importing an app, and side-effect and dynamic imports", () => {
    expect(
      lines(
        "packages/shared/src/warframe/x.ts",
        `import "../../../../apps/web/src/main"\nconst m = import("../../../../apps/api/src/db")`,
      ),
    ).toEqual([1, 2])
  })

  test("allows listed exceptions and unrelated imports", () => {
    expect(
      lines(
        "data/curated/x.ts",
        `import type { DeUpgrade } from "../../scripts/build/de-types"\nimport { z } from "zod"`,
      ),
    ).toEqual([])
    expect(
      lines(
        "data/curated/x.ts",
        `import { readDe } from "../../scripts/build/read-de"`,
      ),
    ).toEqual([1])
  })

  test("ignores files no rule covers", () => {
    expect(
      lines(
        "apps/web/src/routes/_app/x.tsx",
        `import { E } from "@/components/build-editor"`,
      ),
    ).toEqual([])
  })
})
