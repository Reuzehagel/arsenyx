import {
  ISSUE_REPORT_BODY_MAX,
  ISSUE_REPORT_BODY_MIN,
  ISSUE_REPORT_KINDS,
  ISSUE_REPORT_TITLE_MAX,
  ISSUE_REPORT_TITLE_MIN,
  ISSUE_REPORT_URL_MAX,
  ISSUE_REPORTS_LISTED,
  ISSUE_REPORTS_PER_DAY,
  isIssueReportKind,
  type IssueReportContext,
  type IssueReportDto,
  type IssueReportKind,
  type IssueReportListResponse,
  type IssueReportStatus,
} from "@arsenyx/shared/api/issue-reports"
import { Hono } from "hono"

import { prisma } from "../db"
import { webOrigins } from "../env"
import {
  createGithubIssue,
  githubAppConfig,
  githubIssueStatuses,
  githubLoginForId,
} from "../lib/github-app"
import { requireUser } from "../lib/session"
import { httpError, parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"

// Signed-in users file GitHub issues from the site. The issue is opened by the
// GitHub App (lib/github-app.ts) and mentions the reporter's GitHub login, so
// they're subscribed to replies without granting Arsenyx any repo scope.

export const reports = new Hono()

/** Every report carries this label, so they can be told apart on GitHub. */
export const FROM_WEBSITE_LABEL = "from-website"

const DAY_MS = 24 * 60 * 60_000

export interface ReportInput {
  kind: IssueReportKind
  title: string
  description: string
  pageUrl: string | null
  context: IssueReportContext
}

/** Validates a POST body, or throws a 400 naming the bad field. */
export function parseReportInput(body: Record<string, unknown>): ReportInput {
  const { kind, title, description, pageUrl, context } = body
  if (!isIssueReportKind(kind)) throw httpError(400, "invalid_kind")

  const t = typeof title === "string" ? title.replace(/\s+/g, " ").trim() : ""
  if (t.length < ISSUE_REPORT_TITLE_MIN || t.length > ISSUE_REPORT_TITLE_MAX) {
    throw httpError(400, "invalid_title")
  }

  const d = typeof description === "string" ? description.trim() : ""
  if (d.length < ISSUE_REPORT_BODY_MIN || d.length > ISSUE_REPORT_BODY_MAX) {
    throw httpError(400, "invalid_description")
  }

  let url: string | null = null
  if (typeof pageUrl === "string" && pageUrl.trim()) {
    url = pageUrl.trim()
    if (url.length > ISSUE_REPORT_URL_MAX || !isSiteUrl(url)) {
      throw httpError(400, "invalid_page_url")
    }
  } else if (pageUrl != null && pageUrl !== "") {
    throw httpError(400, "invalid_page_url")
  }

  return {
    kind,
    title: t,
    description: d,
    pageUrl: url,
    context: parseContext(context),
  }
}

// Each context field must match its shape or it's dropped: it's diagnostic
// extra the user didn't type, so a malformed one never fails the report. The
// patterns also keep backticks, pipes and newlines out of the table cells.
const CONTEXT_FIELDS = {
  userAgent: /^[\x20-\x7e]{1,300}$/,
  viewport: /^\d{1,5}x\d{1,5}$/,
  dataVersion: /^[\w.:+-]{1,64}$/,
  appBuild: /^[\w.-]{1,80}$/,
} as const satisfies Record<keyof IssueReportContext, RegExp>

export function parseContext(raw: unknown): IssueReportContext {
  if (!raw || typeof raw !== "object") return {}
  const out: IssueReportContext = {}
  for (const [key, pattern] of Object.entries(CONTEXT_FIELDS)) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v !== "string" || !pattern.test(v)) continue
    // The user agent's printable-ASCII range still allows these two.
    if (/[`|]/.test(v)) continue
    out[key as keyof IssueReportContext] = v
  }
  return out
}

const CONTEXT_LABELS: Record<keyof IssueReportContext, string> = {
  userAgent: "Browser",
  viewport: "Viewport",
  dataVersion: "Game data",
  appBuild: "App build",
}

function contextBlock(context: IssueReportContext): string[] {
  const rows = (
    Object.keys(CONTEXT_LABELS) as (keyof IssueReportContext)[]
  ).flatMap((k) =>
    context[k] ? [`| ${CONTEXT_LABELS[k]} | \`${context[k]}\` |`] : [],
  )
  if (rows.length === 0) return []
  return [
    "",
    "<details><summary>Context</summary>",
    "",
    "| | |",
    "|-|-|",
    ...rows,
    "",
    "</details>",
  ]
}

/** Only links to the site itself: the field says where on Arsenyx it
 *  happened, and an arbitrary URL would turn the issue into a link drop. */
function isSiteUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return webOrigins.includes(u.origin)
  } catch {
    return false
  }
}

/** Breaks `@name` mentions (and `@org/team`) in user text with a zero-width
 *  space, so a report can't make the App ping arbitrary GitHub users. */
export function neutralizeMentions(text: string): string {
  return text.replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, "$1@​")
}

export function issueBody(
  input: ReportInput,
  reporter: { githubLogin: string | null; username: string | null },
): string {
  const site = webOrigins[0]
  const credit = reporter.githubLogin ? `@${reporter.githubLogin}` : "a user"
  const profile = reporter.username
    ? ` ([Arsenyx profile](${site}/profile/${encodeURIComponent(reporter.username)}))`
    : ""
  const lines = [
    neutralizeMentions(input.description),
    "",
    "---",
    `Reported from the website by ${credit}${profile}.`,
  ]
  if (input.pageUrl) lines.push(`Page: ${input.pageUrl}`)
  lines.push(...contextBlock(input.context))
  return lines.join("\n")
}

function toDto(
  r: {
    id: string
    kind: string
    title: string
    issueNumber: number
    issueUrl: string
    createdAt: Date
  },
  status: IssueReportStatus | null = null,
): IssueReportDto {
  return {
    id: r.id,
    kind: isIssueReportKind(r.kind) ? r.kind : "bug",
    title: r.title,
    issueNumber: r.issueNumber,
    issueUrl: r.issueUrl,
    createdAt: r.createdAt.toISOString(),
    status,
  }
}

const REPORT_SELECT = {
  id: true,
  kind: true,
  title: true,
  issueNumber: true,
  issueUrl: true,
  createdAt: true,
} as const

reports.get("/", async (c) => {
  const user = await requireUser(c)
  const rows = await prisma.issueReport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: ISSUE_REPORTS_LISTED,
    select: REPORT_SELECT,
  })
  const cfg = githubAppConfig()
  const statuses =
    cfg && rows.length > 0
      ? await githubIssueStatuses(
          cfg,
          rows.map((r) => r.issueNumber),
        )
      : new Map<number, IssueReportStatus>()
  const payload: IssueReportListResponse = {
    available: cfg !== null,
    reports: rows.map((r) => toDto(r, statuses.get(r.issueNumber) ?? null)),
  }
  return c.json(payload)
})

reports.post("/", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)
  const input = parseReportInput(await parseJsonBody(c, { maxBytes: 16_384 }))

  const cfg = githubAppConfig()
  if (!cfg) throw httpError(503, "reports_unavailable")

  const recent = await prisma.issueReport.count({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - DAY_MS) },
    },
  })
  if (recent >= ISSUE_REPORTS_PER_DAY) throw httpError(429, "report_limit")

  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "github" },
    select: { accountId: true },
  })
  const githubLogin = account
    ? await githubLoginForId(cfg, account.accountId)
    : null

  let issue
  try {
    issue = await createGithubIssue(cfg, {
      title: input.title,
      body: issueBody(input, {
        githubLogin,
        username: user.username ?? null,
      }),
      labels: [FROM_WEBSITE_LABEL, ISSUE_REPORT_KINDS[input.kind].githubLabel],
    })
  } catch (err) {
    console.error("reports: GitHub issue creation failed", {
      message: (err as Error).message,
    })
    throw httpError(502, "github_failed")
  }

  const row = await prisma.issueReport.create({
    data: {
      userId: user.id,
      kind: input.kind,
      title: input.title,
      issueNumber: issue.number,
      issueUrl: issue.url,
    },
    select: REPORT_SELECT,
  })
  return c.json(toDto(row), 201)
})
