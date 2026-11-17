import {
  ISSUE_REPORT_BODY_MAX,
  ISSUE_REPORT_BODY_MIN,
  ISSUE_REPORT_KINDS,
  ISSUE_REPORT_TITLE_MAX,
  ISSUE_REPORT_TITLE_MIN,
  ISSUE_REPORT_URL_MAX,
  type IssueReportDto,
  type IssueReportKind,
} from "@arsenyx/shared/api/issue-reports"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { Bug, CheckCircle2, ExternalLink } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { authClient } from "@/lib/auth-client"
import { myReportsQuery, useSubmitReport } from "@/lib/queries/report-query"
import { pageSeo } from "@/lib/seo"
import { EXTERNAL_LINKS } from "@/lib/util/constants"
import { relativeTime } from "@/lib/util/relative-time"

type ReportSearch = { from?: string }

export const Route = createFileRoute("/_app/report")({
  head: () => pageSeo("/report"),
  /** `?from=`: the in-site path the user was on, prefilled as the page link. */
  validateSearch: (search: Record<string, unknown>): ReportSearch =>
    typeof search.from === "string" && /^\/(?![/\\])/.test(search.from)
      ? { from: search.from }
      : {},
  component: ReportPage,
})

const KIND_ITEMS = Object.entries(ISSUE_REPORT_KINDS).map(([value, k]) => ({
  value,
  label: k.label,
}))

function ReportPage() {
  const { data: session, isPending } = authClient.useSession()

  return (
    <div className="wrap flex max-w-2xl flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Report an issue</h1>
        <p className="text-muted-foreground text-sm">
          Found a bug, wrong game data, or have an idea? Tell us here and it
          goes straight to the project's GitHub issues.
        </p>
      </div>
      {isPending ? null : session?.user ? <SignedIn /> : <SignedOut />}
    </div>
  )
}

function GithubFallback() {
  return (
    <a
      href={EXTERNAL_LINKS.reportIssue}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4"
    >
      open it on GitHub
    </a>
  )
}

function SignedOut() {
  const { from } = Route.useSearch()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to send a report</CardTitle>
        <CardDescription>
          Reports are credited to your GitHub account, so you get notified when
          someone replies. You can also <GithubFallback /> yourself.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          nativeButton={false}
          render={
            <RouterLink
              to="/auth/signin"
              search={{
                redirect: from
                  ? `/report?from=${encodeURIComponent(from)}`
                  : "/report",
              }}
            />
          }
        >
          Sign in with GitHub
        </Button>
      </CardFooter>
    </Card>
  )
}

function SignedIn() {
  const { data, error } = useQuery(myReportsQuery)

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{error.message}</AlertTitle>
        <AlertDescription>
          You can still <GithubFallback />.
        </AlertDescription>
      </Alert>
    )
  }
  if (!data) return null

  return (
    <>
      {data.available ? (
        <ReportForm />
      ) : (
        <Alert>
          <AlertTitle>Reporting from the site isn't set up here</AlertTitle>
          <AlertDescription>
            Please <GithubFallback /> instead.
          </AlertDescription>
        </Alert>
      )}
      {data.reports.length > 0 ? <MyReports reports={data.reports} /> : null}
    </>
  )
}

function ReportForm() {
  const { from } = Route.useSearch()
  const submit = useSubmitReport()

  const [kind, setKind] = useState<IssueReportKind>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pageUrl, setPageUrl] = useState(
    from ? `${window.location.origin}${from}` : "",
  )

  const sent = submit.data
  const error = submit.error instanceof Error ? submit.error.message : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit.mutate(
      {
        kind,
        title: title.trim(),
        description: description.trim(),
        pageUrl: pageUrl.trim(),
      },
      {
        onSuccess: () => {
          setTitle("")
          setDescription("")
          setPageUrl("")
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>New report</CardTitle>
          <CardDescription>
            Reports are public GitHub issues that mention your GitHub username,
            so don't include anything private.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {sent ? (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>Thanks, your report is in</AlertTitle>
                <AlertDescription>
                  <a
                    href={sent.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    Issue #{sent.issueNumber}
                  </a>{" "}
                  is open on GitHub. You'll get a GitHub notification when
                  someone replies.
                </AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="report-kind">Type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(val) => {
                  if (val) setKind(val as IssueReportKind)
                }}
                items={KIND_ITEMS}
              >
                <SelectTrigger id="report-kind" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {KIND_ITEMS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="report-title">Title</FieldLabel>
              <Input
                id="report-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the problem or idea"
                minLength={ISSUE_REPORT_TITLE_MIN}
                maxLength={ISSUE_REPORT_TITLE_MAX}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="report-description">Details</FieldLabel>
              <Textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  kind === "bug"
                    ? "What did you do, what did you expect, and what happened instead?"
                    : "Describe it in as much detail as you can."
                }
                minLength={ISSUE_REPORT_BODY_MIN}
                maxLength={ISSUE_REPORT_BODY_MAX}
                rows={8}
                required
              />
              <FieldDescription>
                Markdown works. {description.length}/{ISSUE_REPORT_BODY_MAX}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="report-page">
                Page link (optional)
              </FieldLabel>
              <Input
                id="report-page"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder={`${window.location.origin}/builds/…`}
                maxLength={ISSUE_REPORT_URL_MAX}
                type="url"
              />
              <FieldDescription>
                The Arsenyx page where it happened, if there is one.
              </FieldDescription>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={submit.isPending}>
            <Bug />
            {submit.isPending ? "Sending…" : "Send report"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function MyReports({ reports }: { reports: IssueReportDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your reports</CardTitle>
        <CardDescription>Follow progress on GitHub.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 truncate">{r.title}</span>
              <span className="text-muted-foreground shrink-0">
                {relativeTime(r.createdAt)}
              </span>
              <a
                href={r.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1"
              >
                #{r.issueNumber}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
