import { describe, expect, it } from "bun:test"

import { findNativeButtonOffenders } from "./native-button"

describe("findNativeButtonOffenders", () => {
  it("flags a Button rendering a link without nativeButton", () => {
    const src = `x\n<Button render={<RouterLink to="/builds" />}>Go</Button>`
    expect(findNativeButtonOffenders(src)).toEqual([2])
  })

  it("flags a multi-line tag and an <a>", () => {
    const src = `<Button\n  variant="outline"\n  render={\n    <a href="/x" />\n  }\n>\n  X\n</Button>`
    expect(findNativeButtonOffenders(src)).toEqual([1])
  })

  it("accepts nativeButton={false}, a <button> render, and no render", () => {
    const src = [
      `<Button nativeButton={false} render={<RouterLink to="/" />}>A</Button>`,
      `<Button render={<Link href="/x" />} nativeButton={false}>A2</Button>`,
      `<Button render={<button type="submit" />}>B</Button>`,
      `<Button onClick={() => go()}>C</Button>`,
      `<ButtonGroup render={<div />} />`,
    ].join("\n")
    expect(findNativeButtonOffenders(src)).toEqual([])
  })
})
