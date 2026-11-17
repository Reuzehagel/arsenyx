import { describe, expect, it } from "vitest"

import { webOrigins } from "../env"
import { issueBody, neutralizeMentions, parseReportInput } from "./reports"

const valid = {
  kind: "bug",
  title: "Mod search drops results",
  description: "Searching for Serration shows nothing.",
}

const errorCode = (fn: () => unknown) => {
  try {
    fn()
  } catch (err) {
    return (err as { res?: Response }).res?.status
  }
  return "no error"
}

describe("parseReportInput", () => {
  it("accepts a valid report and collapses title whitespace", () => {
    expect(
      parseReportInput({ ...valid, title: "  Mod   search\ndrops results " }),
    ).toEqual({ ...valid, pageUrl: null })
  })

  it("rejects an unknown kind, short title or short description", () => {
    expect(errorCode(() => parseReportInput({ ...valid, kind: "spam" }))).toBe(
      400,
    )
    expect(errorCode(() => parseReportInput({ ...valid, title: "hi" }))).toBe(
      400,
    )
    expect(
      errorCode(() => parseReportInput({ ...valid, description: "x" })),
    ).toBe(400)
  })

  it("accepts only page links on the site itself", () => {
    const own = `${webOrigins[0]}/builds/abc`
    expect(parseReportInput({ ...valid, pageUrl: own }).pageUrl).toBe(own)
    expect(
      errorCode(() =>
        parseReportInput({ ...valid, pageUrl: "https://evil.example/x" }),
      ),
    ).toBe(400)
    expect(
      errorCode(() => parseReportInput({ ...valid, pageUrl: "javascript:1" })),
    ).toBe(400)
  })
})

describe("neutralizeMentions", () => {
  it("breaks @mentions but leaves emails and code alone", () => {
    expect(neutralizeMentions("ping @someone and @org/team")).toBe(
      "ping @​someone and @​org/team",
    )
    expect(neutralizeMentions("@lead")).toBe("@​lead")
    expect(neutralizeMentions("me@example.com `@x`")).toBe(
      "me@example.com `@x`",
    )
  })
})

describe("issueBody", () => {
  it("credits the reporter's GitHub login and links the page", () => {
    const body = issueBody(
      { ...parseReportInput(valid), pageUrl: `${webOrigins[0]}/browse` },
      { githubLogin: "Reporter", username: "reporter" },
    )
    expect(body).toContain("Reported from the website by @Reporter")
    expect(body).toContain(`${webOrigins[0]}/profile/reporter`)
    expect(body).toContain(`Page: ${webOrigins[0]}/browse`)
  })

  it("falls back to no mention when the login is unknown", () => {
    const body = issueBody(parseReportInput(valid), {
      githubLogin: null,
      username: null,
    })
    expect(body).toContain("Reported from the website by a user.")
  })
})
