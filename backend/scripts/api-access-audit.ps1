param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutDir = "artifacts"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

function New-Result($name, $role, $method, $path, $expected, $actual, $ok, $message) {
  [PSCustomObject]@{
    name = $name
    role = $role
    method = $method
    path = $path
    expected = $expected
    actual = $actual
    passed = $ok
    message = $message
    timestamp = (Get-Date).ToString("s")
  }
}

function Invoke-TestRequest {
  param(
    [string]$Name,
    [string]$Role,
    [string]$Method,
    [string]$Path,
    [int[]]$Expected,
    [string]$Token,
    $Body
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  try {
    $jsonBody = $null
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 8
    }
    $resp = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method $Method -Headers $headers -ContentType "application/json" -Body $jsonBody
    $status = [int]$resp.StatusCode
    return New-Result $Name $Role $Method $Path ($Expected -join "/") $status ($Expected -contains $status) ""
  } catch {
    $status = 0
    $msg = $_.Exception.Message
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    return New-Result $Name $Role $Method $Path ($Expected -join "/") $status ($Expected -contains $status) $msg
  }
}

$guid = [guid]::NewGuid().ToString("N").Substring(0, 10)
$customerEmail = "qa.user.$guid@example.com"
$customerPassword = "Password@123"

Write-Host "[1/5] Register QA customer: $customerEmail"
$register = @{ email = $customerEmail; password = $customerPassword; fullName = "QA User $guid" } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method Post -ContentType "application/json" -Body $register | Out-Null

Write-Host "[2/5] Login roles"
$adminLogin = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "admin@badminton.local"; password = "Password@123" } | ConvertTo-Json)
$staffLogin = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "staff@badminton.local"; password = "Password@123" } | ConvertTo-Json)
$customerLogin = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = $customerEmail; password = $customerPassword } | ConvertTo-Json)

$adminToken = $adminLogin.accessToken
$staffToken = $staffLogin.accessToken
$customerToken = $customerLogin.accessToken

Write-Host "[3/5] Prepare IDs"
$courts = Invoke-RestMethod -Uri "$BaseUrl/courts?status=ACTIVE" -Method Get
if (($courts.items | Measure-Object).Count -eq 0) {
  throw "No ACTIVE courts found. Run seed first."
}
$courtId = $courts.items[0].id

$date = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$hour = Get-Random -Minimum 7 -Maximum 21
$startTime = "{0:D2}:00" -f $hour
$endTime = "{0:D2}:00" -f ($hour + 1)

$hold = Invoke-RestMethod -Uri "$BaseUrl/bookings/hold" -Method Post -Headers @{ Authorization = "Bearer $customerToken"; 'Idempotency-Key' = "qa-hold-$guid" } -ContentType "application/json" -Body (@{ courtId = $courtId; date = $date; startTime = $startTime; endTime = $endTime } | ConvertTo-Json)
$booking = Invoke-RestMethod -Uri "$BaseUrl/bookings" -Method Post -Headers @{ Authorization = "Bearer $customerToken" } -ContentType "application/json" -Body (@{ bookingId = $hold.booking.id } | ConvertTo-Json)
$bookingId = $booking.id

Write-Host "[4/5] Run endpoint access matrix"
$results = @()

$results += Invoke-TestRequest -Name "public_courts" -Role "anonymous" -Method "GET" -Path "/courts" -Expected @(200)
$results += Invoke-TestRequest -Name "anon_me" -Role "anonymous" -Method "GET" -Path "/users/me" -Expected @(401)

$results += Invoke-TestRequest -Name "customer_profile" -Role "customer" -Method "GET" -Path "/users/me" -Expected @(200) -Token $customerToken
$results += Invoke-TestRequest -Name "customer_notifications" -Role "customer" -Method "GET" -Path "/notifications" -Expected @(200) -Token $customerToken
$results += Invoke-TestRequest -Name "customer_reports_forbidden" -Role "customer" -Method "GET" -Path "/reports/summary" -Expected @(403, 401) -Token $customerToken

$results += Invoke-TestRequest -Name "staff_reports" -Role "staff" -Method "GET" -Path "/reports/summary" -Expected @(200) -Token $staffToken
$results += Invoke-TestRequest -Name "staff_admin_users_forbidden" -Role "staff" -Method "GET" -Path "/admin/users" -Expected @(403) -Token $staffToken
$results += Invoke-TestRequest -Name "staff_booking_ops" -Role "staff" -Method "POST" -Path "/bookings/$bookingId/check-in" -Expected @(200) -Token $staffToken

$results += Invoke-TestRequest -Name "admin_users_list" -Role "admin" -Method "GET" -Path "/admin/users" -Expected @(200) -Token $adminToken
$results += Invoke-TestRequest -Name "admin_courts_inactive" -Role "admin" -Method "GET" -Path "/courts?includeInactive=true" -Expected @(200) -Token $adminToken
$results += Invoke-TestRequest -Name "admin_revenue" -Role "admin" -Method "GET" -Path "/reports/revenue?from=$date&to=$date&groupBy=day" -Expected @(200) -Token $adminToken

$results += Invoke-TestRequest -Name "customer_admin_users_forbidden" -Role "customer" -Method "GET" -Path "/admin/users" -Expected @(403) -Token $customerToken

Write-Host "[5/5] Write report"
$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$reportPath = Join-Path $OutDir "api-access-report-$stamp.json"
$summary = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString("s")
  baseUrl = $BaseUrl
  qaUser = $customerEmail
  total = ($results | Measure-Object).Count
  passed = ($results | Where-Object { $_.passed } | Measure-Object).Count
  failed = ($results | Where-Object { -not $_.passed } | Measure-Object).Count
  results = $results
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host "Done. Report: $reportPath"
if ($summary.failed -gt 0) {
  Write-Host "Some checks failed:" -ForegroundColor Yellow
  $results | Where-Object { -not $_.passed } | Format-Table -AutoSize
  exit 1
}
