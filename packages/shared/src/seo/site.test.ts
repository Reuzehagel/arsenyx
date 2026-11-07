import { expect, it } from "vitest"

import { IMAGE_CDN } from "../warframe/image-hosts"
import { absoluteImage } from "./site"

it("resolves bare filenames against the same CDN as image-hosts", () => {
  expect(absoluteImage("a.png")).toBe(`${IMAGE_CDN}a.png`)
})
