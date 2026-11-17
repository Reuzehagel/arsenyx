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
import { Link as RouterLink } from "@tanstack/react-router"
import { Bug, CheckCircle2, ExternalLink } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { EXTERNAL_LINKS } from "@/lib/util/constants"
import { relativeTime } from "@/lib/util/relative-time"

const KIND_ITEMS = Object.entries(ISSUE_REPORT_KINDS).map(([value, k]) => ({
  value,
  label: k.label,
}))

/** How many past reports the dialog lists under the form. */
const RECENT_REPORTS = 3

export function ReportDialog({
  open,
  onOpenChange,
  pageUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageUrl: string
}) {
  const { data: session, isPending } = authClient.useSession()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Found a bug, wrong game data, or have an idea? It goes straight to
            the project's GitHub issues.
          </DialogDescription>
        </DialogHeader>
        {isPending ? null : session?.user ? (
          <SignedIn pageUrl={pageUrl} onDone={() => onOpenChange(false)} />
        ) : (
          <SignedOut pageUrl={pageUrl} />
        )}
      </DialogContent>
    </Dialog>
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

function SignedOut({ pageUrl }: { pageUrl: string }) {
  const { pathname, search } = new URL(pageUrl || window.location.href)
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Sign in to send a report. It's credited to your GitHub account, so you
        get notified when someone replies. You can also <GithubFallback />{" "}
        yourself.
      </p>
      <DialogFooter>
        <Button
          nativeButton={false}
          render={
            <RouterLink
              to="/auth/signin"
              search={{ redirect: `${pathname}${search}` }}
            />
          }
        >
          Sign in with GitHub
        </Button>
      </DialogFooter>
    </>
  )
}

function SignedIn({
  pageUrl,
  onDone,
}: {
  pageUrl: string
  onDone: () => void
}) {
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

  const recent =
    data.reports.length > 0 ? (
      <RecentReports reports={data.reports.slice(0, RECENT_REPORTS)} />
    ) : null

  return (
    <>
      {data.available ? (
        <ReportForm initialPageUrl={pageUrl} onDone={onDone} recent={recent} />
      ) : (
        <>
          <Alert>
            <AlertTitle>Reporting from the site isn't set up here</AlertTitle>
            <AlertDescription>
              Please <GithubFallback /> instead.
            </AlertDescription>
          </Alert>
          {recent}
        </>
      )}
    </>
  )
}

function ReportForm({
  initialPageUrl,
  onDone,
  recent,
}: {
  initialPageUrl: string
  onDone: () => void
  /** Past reports, listed above the footer (DialogFooter is the last band). */
  recent: React.ReactNode
}) {
  const submit = useSubmitReport()

  const [kind, setKind] = useState<IssueReportKind>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pageUrl, setPageUrl] = useState(initialPageUrl)

  const error = submit.error instanceof Error ? submit.error.message : null

  if (submit.data) {
    const sent = submit.data
    return (
      <>
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Thanks, your report is in</AlertTitle>
          <AlertDescription>
            <span>
              <a
                href={sent.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Issue #{sent.issueNumber}
              </a>{" "}
              is open on GitHub. You'll get a GitHub notification when someone
              replies.
            </span>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => submit.reset()}>
            Send another
          </Button>
          <Button
            onClick={() => {
              submit.reset()
              onDone()
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

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
        // The dialog keeps this form mounted while the user stays on the
        // page, so a sent report mustn't come back as the next draft.
        onSuccess: () => {
          setTitle("")
          setDescription("")
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="report-kind">Type</FieldLabel>
          <Select
            value={kind}
            onValueChange={(val) => {
              if (val) setKind(val as IssueReportKind)
            }}
            items={KIND_ITEMS}
          >
            <SelectTrigger id="report-kind" className="w-full">
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
            rows={6}
            required
          />
          <FieldDescription>
            Markdown works. {description.length}/{ISSUE_REPORT_BODY_MAX}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="report-page">Page</FieldLabel>
          <Input
            id="report-page"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            maxLength={ISSUE_REPORT_URL_MAX}
            type="url"
          />
          <FieldDescription>
            The page you were on. Clear it if the report isn't about this page.
          </FieldDescription>
        </Field>

        <p className="text-muted-foreground text-xs">
          Reports are public GitHub issues that mention your GitHub username, so
          don't include anything private.
        </p>

        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>

      {recent}

      <DialogFooter>
        <Button type="submit" disabled={submit.isPending}>
          <Bug />
          {submit.isPending ? "Sending…" : "Send report"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RecentReports({ reports }: { reports: IssueReportDto[] }) {
  return (
    <section className="flex flex-col gap-1 border-t pt-3">
      <h3 className="text-muted-foreground text-xs font-medium">
        Your recent reports
      </h3>
      <ul className="flex flex-col">
        {reports.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-1 text-sm">
            <span className="flex-1 truncate">{r.title}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {relativeTime(r.createdAt)}
            </span>
            <a
              href={r.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
            >
              #{r.issueNumber}
              <ExternalLink className="size-3" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
