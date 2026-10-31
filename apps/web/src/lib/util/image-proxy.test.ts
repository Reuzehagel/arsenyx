import { describe, expect, it } from "vitest"

import { API_URL } from "./constants"
import { proxyImage } from "./image-proxy"

const proxied = (u: string) => `${API_URL}/img?u=${encodeURIComponent(u)}`

describe("proxyImage", () => {
  it("proxies absolute http(s) URLs", () => {
    expect(proxyImage("https://a.com/x.png")).toBe(
      proxied("https://a.com/x.png"),
    )
    expect(proxyImage("http://a.com/x.png")).toBe(proxied("http://a.com/x.png"))
  })

  it("proxies slashless scheme URLs instead of letting the browser resolve them", () => {
    expect(proxyImage("https:a.com/x.png")).toBe(proxied("https:a.com/x.png"))
    expect(proxyImage("HTTP:a.com/x.png")).toBe(proxied("HTTP:a.com/x.png"))
  })

  it("normalizes protocol-relative URLs to https", () => {
    expect(proxyImage("//a.com/x.png")).toBe(proxied("https://a.com/x.png"))
    expect(proxyImage("\\\\a.com/x.png")).toBe(proxied("https:\\\\a.com/x.png"))
  })

  it("passes data: and relative URLs through", () => {
    expect(proxyImage("data:image/png;base64,AA")).toBe(
      "data:image/png;base64,AA",
    )
    expect(proxyImage("/img/x.png")).toBe("/img/x.png")
    expect(proxyImage("x.png")).toBe("x.png")
    expect(proxyImage(null)).toBeNull()
  })
})
