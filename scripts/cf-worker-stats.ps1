#requires -Version 5.1
<#
.SYNOPSIS
  Per-Worker CPU + request breakdown from Cloudflare's GraphQL analytics API.

.DESCRIPTION
  Answers "which Worker is burning my CPU time, and is it getting worse?"

  Note on EstTotalCpuMs: the workersInvocationsAdaptive dataset exposes CPU time
  only as PERCENTILES (P50/P99) -- there is no sum. So the total is estimated as
  requests * P50 and will NOT reconcile exactly with the dashboard's billing
  figure. Use the dashboard for what you owe; use this for the per-Worker split.

  The dataset is also adaptively sampled, so request counts are approximate on
  high-volume accounts.

.PARAMETER AccountId
  Cloudflare account tag. Find it with: bunx wrangler whoami

.PARAMETER Days
  How many days back to look. Default 30.

.PARAMETER Daily
  Break results out per day instead of totalling the window -- this is how you
  tell a per-request regression (rising P50) from plain traffic growth (flat P50).

.EXAMPLE
  $env:CF_ANALYTICS_TOKEN = "..."
  .\cf-worker-stats.ps1 -AccountId abc123

.EXAMPLE
  .\cf-worker-stats.ps1 -AccountId abc123 -Days 14 -Daily
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$AccountId,
  [int]$Days = 30,
  [switch]$Daily
)

$ErrorActionPreference = 'Stop'

# Deliberately NOT named CF_API_TOKEN or CLOUDFLARE_API_TOKEN: wrangler reads
# both for its own auth, so an analytics-only token parked in either name
# hijacks every `wrangler` invocation in the shell ("Invalid format for
# Authorization header" on `wrangler whoami`). Keep this token in its own name.
if (-not $env:CF_ANALYTICS_TOKEN) {
  Write-Error @'
CF_ANALYTICS_TOKEN is not set.

Create a token at https://dash.cloudflare.com/profile/api-tokens with
permission: Account -> Account Analytics -> Read, then:

  $env:CF_ANALYTICS_TOKEN = "your-token-here"

Set it in the session rather than hardcoding it here, so the token never
lands in a file that could get committed.
'@
}

# Strip stray whitespace and surrounding quotes. A token pasted as
# `$env:CF_ANALYTICS_TOKEN = '"abc"'`, or with a trailing newline from a copy,
# builds a malformed Authorization header -- which Cloudflare reports as the
# deeply unhelpful "Authentication failed" (code 9106), meaning it saw no usable
# header at all rather than a valid-but-unauthorized one.
$token = $env:CF_ANALYTICS_TOKEN.Trim().Trim('"', "'").Trim()

# A real API token is a ~40-char opaque string. Surface the shape (never the
# value) so a paste error is obvious without leaking the secret into scrollback.
$mask = if ($token.Length -ge 8) {
  '{0}...{1}' -f $token.Substring(0, 4), $token.Substring($token.Length - 4)
} else { '(too short to mask)' }
Write-Host "Token: $($token.Length) chars, $mask" -ForegroundColor DarkGray

if ($token -match '\s') {
  Write-Warning 'Token contains whitespace even after trimming -- it is very likely a bad paste.'
}

# The account id and the token are both opaque hex-ish strings copied out of the
# same dashboard, so transposing them is an easy mistake. It would otherwise
# surface as a bare "Authentication failed", which points nowhere useful.
if ($token -eq $AccountId) {
  Write-Host ''
  Write-Host 'CF_ANALYTICS_TOKEN is set to your ACCOUNT ID, not to an API token.' -ForegroundColor Red
  Write-Host 'They are different things: the account id identifies you, the token authenticates you.' -ForegroundColor Yellow
  Write-Host 'Create a token at https://dash.cloudflare.com/profile/api-tokens' -ForegroundColor Yellow
  Write-Host '  -> Create Token -> Custom token -> Account / Account Analytics / Read' -ForegroundColor Yellow
  exit 1
}

# Account ids are exactly 32 lowercase hex chars; API tokens are ~40 chars of
# mixed case with dashes/underscores. A 32-hex value here is almost always an
# account id or a token ID copied from the token list page.
if ($token -match '^[0-9a-f]{32}$') {
  Write-Warning 'That looks like a 32-char hex id, not an API token. API tokens are ~40 chars of mixed case.'
}

# Cloudflare has TWO token families and they verify at DIFFERENT endpoints:
#   user-owned    -> /user/tokens/verify
#   account-owned -> /accounts/{id}/tokens/verify   (value is prefixed `cfat_`)
# Sending an account-owned token to the user endpoint fails even when the token
# is perfectly valid, so route by prefix rather than assuming user-owned.
$verifyUrl = if ($token -like 'cfat_*') {
  "https://api.cloudflare.com/client/v4/accounts/$AccountId/tokens/verify"
} else {
  'https://api.cloudflare.com/client/v4/user/tokens/verify'
}

# Verification is a HINT, never a gate. It exists to separate "bad token" from
# "token lacks Account Analytics: Read" when things fail -- but the GraphQL query
# below is the only real test, so a failure here warns and continues. Blocking on
# it turned a false negative into a dead end.
$verified = $false
try {
  $v = Invoke-RestMethod -Uri $verifyUrl -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
  Write-Host "Token verified: status '$($v.result.status)'" -ForegroundColor Green
  $verified = $true
}
catch {
  Write-Warning "Self-verification failed at $verifyUrl -- continuing anyway, the query below is the real test."
  Write-Host '  If the query also fails, check in this order:' -ForegroundColor DarkGray
  Write-Host '    1. Token needs permission: Account -> Account Analytics -> Read' -ForegroundColor DarkGray
  Write-Host "    2. Token must be scoped to include account $AccountId" -ForegroundColor DarkGray
  Write-Host '    3. Copy the token VALUE from the post-creation screen, not the ID from the list' -ForegroundColor DarkGray
}

$start = (Get-Date).ToUniversalTime().AddDays(-$Days).ToString('yyyy-MM-ddTHH:mm:ssZ')
$end   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

# Grouping is driven by which dimensions we request: scriptName alone collapses
# the whole window into one row per Worker; adding `date` gives a daily series.
$dimensions = if ($Daily) { 'scriptName date' } else { 'scriptName' }

# Values are inlined rather than passed as GraphQL variables on purpose -- CF's
# schema uses unconventional scalar names for filter args, and getting one wrong
# fails the whole query. Inlining sidesteps declaring them.
$query = @"
{
  viewer {
    accounts(filter: { accountTag: "$AccountId" }) {
      workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: "$start", datetime_leq: "$end" }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests errors subrequests }
        quantiles { cpuTimeP50 cpuTimeP99 }
        dimensions { $dimensions }
      }
    }
  }
}
"@

Write-Host "Querying $($Days)d window: $start -> $end" -ForegroundColor Cyan

try {
  $response = Invoke-RestMethod `
    -Uri 'https://api.cloudflare.com/client/v4/graphql' `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json' `
    -Body (@{ query = $query } | ConvertTo-Json -Depth 5) `
    -ErrorAction Stop
}
catch {
  # On a non-2xx, Invoke-RestMethod throws and the useful part is the response
  # BODY, which PowerShell hides inside the exception. Dig it out -- the property
  # differs between PS 5.1 (needs a stream read) and PS 7 (ErrorDetails).
  Write-Host ''
  Write-Host 'The GraphQL request failed at the HTTP level.' -ForegroundColor Red
  $body = $_.ErrorDetails.Message
  if (-not $body -and $_.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
    } catch { }
  }
  if ($body) { Write-Host $body -ForegroundColor DarkGray }
  Write-Host ''
  if ($verified) {
    Write-Host 'The token DID self-verify, so the value is genuine -- this is a scope problem.' -ForegroundColor Yellow
    Write-Host "Add permission Account -> Account Analytics -> Read, scoped to account $AccountId." -ForegroundColor Yellow
  }
  else {
    Write-Host 'The token also failed self-verification, so the VALUE is likely wrong.' -ForegroundColor Yellow
    Write-Host 'Copy it from the screen shown immediately after Create Token -- the 32-hex' -ForegroundColor Yellow
    Write-Host 'string on the token list page is the token ID, not the token value.' -ForegroundColor Yellow
  }
  exit 1
}

# GraphQL reports failures in an `errors` array with HTTP 200, so a non-throwing
# call is not the same as a successful query.
if ($response.errors) {
  Write-Host 'GraphQL returned errors:' -ForegroundColor Red
  $response.errors | ForEach-Object { Write-Host "  - $($_.message)" -ForegroundColor Red }
  exit 1
}

$accounts = $response.data.viewer.accounts
if (-not $accounts) {
  Write-Error "No account matched '$AccountId'. Check the id with: bunx wrangler whoami"
}

$rows = $accounts[0].workersInvocationsAdaptive
if (-not $rows) {
  Write-Host 'No invocation data in this window.' -ForegroundColor Yellow
  exit 0
}

# cpuTimeP50/P99 come back in MICROSECONDS despite the docs describing them as
# milliseconds. Confirmed empirically: a P50 of ~21000 for arsenyx-api would be
# 21 SECONDS of CPU per request, which exceeds the invocation limit and would not
# reconcile with the account's actual monthly total. Divide to get real ms.
$table = $rows | ForEach-Object {
  $req    = [double]$_.sum.requests
  $p50Ms  = [double]$_.quantiles.cpuTimeP50 / 1000
  $p99Ms  = [double]$_.quantiles.cpuTimeP99 / 1000
  $out = [ordered]@{ Worker = $_.dimensions.scriptName }
  if ($Daily) { $out['Date'] = $_.dimensions.date }
  $out['Requests']      = [long]$req
  $out['Errors']        = [long]$_.sum.errors
  $out['Subrequests']   = [long]$_.sum.subrequests
  $out['CpuP50ms']      = [math]::Round($p50Ms, 2)
  $out['CpuP99ms']      = [math]::Round($p99Ms, 2)
  $out['EstCpuMs']      = [long][math]::Round($req * $p50Ms)
  # P99/P50 quantifies tail skew. When it is large the median badly understates
  # the mean, so EstCpuMs (built on P50) is a FLOOR, not an estimate of the mean.
  $out['TailRatio']     = if ($p50Ms -gt 0) { [math]::Round($p99Ms / $p50Ms, 1) } else { 0 }
  [pscustomobject]$out
}

$table | Format-Table -AutoSize

$totalReq = ($table | Measure-Object -Property Requests -Sum).Sum
$totalCpu = ($table | Measure-Object -Property EstCpuMs -Sum).Sum

Write-Host ''
Write-Host ("Requests:      {0,15:N0}   (10M included, then `$0.30/M)" -f $totalReq)
Write-Host ("Est. CPU ms:   {0,15:N0}   (30M included, then `$0.02/M)" -f $totalCpu)
Write-Host ''

# Per-Worker share is the actionable number: optimising the Worker that holds 1%
# of total CPU cannot move the bill, however tidy the change is.
Write-Host 'Share of estimated CPU by Worker:' -ForegroundColor Cyan
$table | Group-Object Worker | ForEach-Object {
  $cpu = ($_.Group | Measure-Object -Property EstCpuMs -Sum).Sum
  $req = ($_.Group | Measure-Object -Property Requests -Sum).Sum
  [pscustomobject]@{
    Worker      = $_.Name
    Requests    = [long]$req
    EstCpuMs    = [long]$cpu
    PctOfCpu    = if ($totalCpu -gt 0) { [math]::Round(100 * $cpu / $totalCpu, 1) } else { 0 }
    MsPerReq    = if ($req -gt 0) { [math]::Round($cpu / $req, 2) } else { 0 }
  }
} | Sort-Object EstCpuMs -Descending | Format-Table -AutoSize

Write-Host 'Flat CpuP50ms + rising Requests = traffic growth, nothing to fix.'          -ForegroundColor DarkGray
Write-Host 'Rising CpuP50ms = a per-request regression worth chasing.'                  -ForegroundColor DarkGray
Write-Host 'EstCpuMs uses P50, so a high TailRatio means the real total is HIGHER.'     -ForegroundColor DarkGray
