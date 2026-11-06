import { expect, it } from "vitest"

import { dataVersionFromMeta } from "./catalog-files"

it("dataVersionFromMeta", () => {
  expect(
    dataVersionFromMeta('{"generatedAt":"2026-01-01T00:00:00.000Z"}'),
  ).toBe(String(Date.UTC(2026, 0, 1)))
  expect(dataVersionFromMeta(undefined)).toBe("0")
  expect(dataVersionFromMeta("{}")).toBe("0")
  expect(dataVersionFromMeta("not json")).toBe("0")
})
