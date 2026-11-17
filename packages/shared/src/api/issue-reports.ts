// Issue reports submitted from the site (`POST /reports`), which the API files
// as GitHub issues. Shared so the web form and the API agree on the kinds and
// the field limits.

/** The report kinds, mirroring the repo's issue templates
 *  (.github/ISSUE_TEMPLATE). Each maps to the label its template applies. */
export const ISSUE_REPORT_KINDS = {
  bug: { label: "Bug", githubLabel: "bug" },
  feature: { label: "Feature request", githubLabel: "enhancement" },
  data: { label: "Game data correction", githubLabel: "data" },
  ui: { label: "UI/UX feedback", githubLabel: "ui" },
} as const

export type IssueReportKind = keyof typeof ISSUE_REPORT_KINDS

export function isIssueReportKind(v: unknown): v is IssueReportKind {
  return typeof v === "string" && Object.hasOwn(ISSUE_REPORT_KINDS, v)
}

export const ISSUE_REPORT_TITLE_MIN = 5
export const ISSUE_REPORT_TITLE_MAX = 120
export const ISSUE_REPORT_BODY_MIN = 10
export const ISSUE_REPORT_BODY_MAX = 5000
/** The optional "where did it happen" link. */
export const ISSUE_REPORT_URL_MAX = 500

/** Reports one user may file per rolling 24 hours. Each one is a public
 *  GitHub issue, so the cap is tight on purpose. */
export const ISSUE_REPORTS_PER_DAY = 5

/** How many of the user's reports `GET /reports` returns (newest first). */
export const ISSUE_REPORTS_LISTED = 3

/** Browser details the dialog attaches so a report can be reproduced. Every
 *  field is optional; the API drops anything malformed rather than failing
 *  the report. */
export interface IssueReportContext {
  /** `navigator.userAgent`. */
  userAgent?: string
  /** Viewport size, `"<width>x<height>"`. */
  viewport?: string
  /** The catalog version (`__DATA_VERSION__`). */
  dataVersion?: string
  /** The deployed app bundle, from the entry script's hashed filename. */
  appBuild?: string
}

/** Where the GitHub issue stands, read live when the list loads; null when
 *  GitHub couldn't be asked. */
export interface IssueReportStatus {
  state: "open" | "closed" | "not_planned" | "duplicate"
  comments: number
}

export interface IssueReportDto {
  id: string
  kind: IssueReportKind
  title: string
  issueNumber: number
  issueUrl: string
  createdAt: string
  status: IssueReportStatus | null
}

export interface IssueReportListResponse {
  /** False when the API has no GitHub App configured (local dev, or a
   *  missing secret): the form should point at GitHub instead. */
  available: boolean
  reports: IssueReportDto[]
}
