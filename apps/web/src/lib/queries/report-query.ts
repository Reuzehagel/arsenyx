import type {
  IssueReportDto,
  IssueReportKind,
  IssueReportListResponse,
} from "@arsenyx/shared/api/issue-reports"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { apiCall } from "@/lib/util/api-client"

export const reportKeys = {
  mine: ["reports", "mine"] as const,
}

export const myReportsQuery = queryOptions({
  queryKey: reportKeys.mine,
  queryFn: () =>
    apiCall<IssueReportListResponse>("/reports", {
      codes: { default: "Couldn't load your reports." },
    }),
})

export interface ReportInput {
  kind: IssueReportKind
  title: string
  description: string
  pageUrl: string
}

/** `POST /reports`: files a GitHub issue for the signed-in user. */
export function useSubmitReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReportInput) =>
      apiCall<IssueReportDto>("/reports", {
        method: "POST",
        json: input,
        codes: {
          400: "Check the form: a field is too short, too long, or not a link to this site.",
          401: "Your session expired. Sign in again to send the report.",
          429: "You've sent a lot of reports today. Try again tomorrow, or open the issue on GitHub.",
          502: "GitHub didn't accept the report. Try again in a bit, or open the issue on GitHub.",
          503: "Reporting from the site is unavailable right now. Open the issue on GitHub instead.",
          default: "Couldn't send the report. Try again in a bit.",
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.mine }),
  })
}
