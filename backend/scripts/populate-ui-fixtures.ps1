param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Users = 12
)

$ErrorActionPreference = 'Continue'

function New-QAUser($index) {
  $guid = [guid]::NewGuid().ToString("N").Substring(0, 8)
  return @{
    email    = "qa.fix.$index.$guid@example.com"
    password = "Password@123"
    fullName = "QA Fixture $index"
  }
}

function Invoke-Api($uri, $method = "Get", $headers = @{}, $body = $null, $skipError = $false) {
  $params = @{ Uri = $uri; Method = $method; Headers = $headers; ErrorAction = if ($skipError) { 'SilentlyContinue' } else { 'Stop' } }
  if ($body) { $params.ContentType = "application/json"; $params.Body = $body }
  try { return Invoke-RestMethod @params } catch { if (-not $skipError) { throw } }
}

function Poll-Booking($id, $wantStatus, $adminToken, $base, $maxTries = 12) {
  for ($t = 0; $t -lt $maxTries; $t++) {
    Start-Sleep -Seconds 2
    try {
      $b = Invoke-RestMethod -Uri "$base/bookings/$id" -Method Get -Headers @{ Authorization = "Bearer $adminToken" } -ErrorAction Stop
      if ($b.status -eq $wantStatus) { return $true }
    } catch {}
  }
  Write-Host "  WARN: booking $id did not reach $wantStatus" -ForegroundColor Yellow
  return $false
}

# ── Auth ──────────────────────────────────────────────────────────────────────
$admin      = Invoke-Api "$BaseUrl/auth/login" Post -body (@{ email = "admin@badminton.local"; password = "Password@123" } | ConvertTo-Json)
$adminToken = $admin.accessToken

$courts = Invoke-Api "$BaseUrl/courts?status=ACTIVE"
if (($courts.items | Measure-Object).Count -eq 0) { throw "No ACTIVE courts found." }

Write-Host "Creating $Users fixture bookings..." -ForegroundColor Cyan

for ($i = 1; $i -le $Users; $i++) {
  Start-Sleep -Milliseconds 800          # gentle rate-limit buffer

  try {
    # ── User ──────────────────────────────────────────────────────────────────
    $u = New-QAUser $i
    try { Invoke-Api "$BaseUrl/auth/register" Post -body ($u | ConvertTo-Json) } catch {}
    $login = Invoke-Api "$BaseUrl/auth/login" Post -body (@{ email = $u.email; password = $u.password } | ConvertTo-Json)
    $token = $login.accessToken

    $court = $courts.items[($i - 1) % $courts.items.Count]
    $mod   = $i % 6

    # ── Date strategy ─────────────────────────────────────────────────────────
    # mod 0 = CANCELLED (before payment, any date)
    # mod 1 = CONFIRMED (future date OK, past date OK)
    # mod 2 = NO_SHOW   (must be future so booking is CONFIRMED first)
    # mod 3 = PENDING_PAYMENT (any date)
    # mod 4 = REFUND_PENDING → REFUNDED  (MUST be future: >24h for refund policy)
    # mod 5 = COMPLETED (future OK)
    $daysAhead = switch ($mod) {
      2 { 30 + $i }   # future: no-show after confirmed
      4 { 60 + $i }   # future: >24h so cancel triggers REFUND_PENDING
      5 { 15 + $i }   # future: check-in + complete
      default { $i - 3 }  # mix of past/future for revenue chart
    }
    $date      = (Get-Date).AddDays($daysAhead).ToString("yyyy-MM-dd")
    $hour      = 7 + ($i % 10)
    $startTime = "{0:D2}:00" -f $hour
    $endTime   = "{0:D2}:00" -f ($hour + 1)

    # ── Hold ──────────────────────────────────────────────────────────────────
    $holdIdx = [guid]::NewGuid().ToString().Substring(0,8)
    $hold = Invoke-Api "$BaseUrl/bookings/hold" Post `
      -headers @{ Authorization = "Bearer $token"; 'Idempotency-Key' = "h-$holdIdx" } `
      -body (@{ courtId = $court.id; date = $date; startTime = $startTime; endTime = $endTime;
                paymentScenario = @{ providerStatus = "success"; autoWebhook = $false } } | ConvertTo-Json -Depth 6)

    $booking = Invoke-Api "$BaseUrl/bookings" Post `
      -headers @{ Authorization = "Bearer $token" } `
      -body (@{ bookingId = $hold.booking.id } | ConvertTo-Json)

    # ── Payment (for all except pre-pay CANCELLED and PENDING_PAYMENT) ────────
    if ($mod -notin @(0, 3)) {
      $payIdx = [guid]::NewGuid().ToString().Substring(0,8)
      $payment = Invoke-Api "$BaseUrl/payments" Post `
        -headers @{ Authorization = "Bearer $token"; 'Idempotency-Key' = "p-$payIdx" } `
        -body (@{ bookingId = $booking.id; totalAmount = $booking.totalAmount;
                  paymentScenario = @{ providerStatus = "success"; autoWebhook = $false } } | ConvertTo-Json -Depth 6)

      $wb   = @{ paymentId = $payment.id; status = "success"; providerTransactionId = "TX-$payIdx" } | ConvertTo-Json
      $sign = Invoke-Api "$BaseUrl/payments/webhook/mock/sign" Post -body $wb
      Invoke-Api "$BaseUrl/payments/webhook/mock" Post `
        -headers @{ 'x-mock-signature' = $sign.signature } -body $wb | Out-Null

      Poll-Booking $booking.id "CONFIRMED" $adminToken $BaseUrl | Out-Null
    }

    # ── Final state ───────────────────────────────────────────────────────────
    switch ($mod) {
      1 {  # CONFIRMED – leave as is
        Write-Host "[$i] $($booking.id): CONFIRMED" -ForegroundColor Green
      }
      2 {  # NO_SHOW
        $ok = Invoke-Api "$BaseUrl/bookings/$($booking.id)/no-show" Post `
          -headers @{ Authorization = "Bearer $adminToken" } -body "{}" -skipError $true
        if ($ok) { Write-Host "[$i] $($booking.id): NO_SHOW" -ForegroundColor DarkYellow }
        else      { Write-Host "[$i] $($booking.id): CONFIRMED (no-show skipped)" -ForegroundColor DarkYellow }
      }
      0 {  # CANCELLED before payment
        Invoke-Api "$BaseUrl/bookings/$($booking.id)/cancel" Post `
          -headers @{ Authorization = "Bearer $token" } `
          -body (@{ cancelReason = "qa_cancel" } | ConvertTo-Json) | Out-Null
        Write-Host "[$i] $($booking.id): CANCELLED" -ForegroundColor Gray
      }
      4 {  # REFUND_PENDING -> REFUNDED
        # Cancel future booking (>24h away) → triggers REFUND_PENDING
        Invoke-Api "$BaseUrl/bookings/$($booking.id)/cancel" Post `
          -headers @{ Authorization = "Bearer $token" } `
          -body (@{ cancelReason = "qa_cancel_refund" } | ConvertTo-Json) | Out-Null
        Start-Sleep -Seconds 2
        # Directly process refund via payment-service
        $rf = Invoke-Api "$BaseUrl/payments/booking/$($booking.id)/refund" Post `
          -headers @{ Authorization = "Bearer $adminToken" } `
          -body (@{ amount = $booking.totalAmount; reason = "fixture_refund" } | ConvertTo-Json) `
          -skipError $true
        if ($rf) { Write-Host "[$i] $($booking.id): REFUNDED" -ForegroundColor Cyan }
        else      { Write-Host "[$i] $($booking.id): REFUND_PENDING (refund api skipped)" -ForegroundColor Cyan }
      }
      5 {  # COMPLETED
        Invoke-Api "$BaseUrl/bookings/$($booking.id)/check-in" Post `
          -headers @{ Authorization = "Bearer $adminToken" } -body "{}" | Out-Null
        Invoke-Api "$BaseUrl/bookings/$($booking.id)/complete" Post `
          -headers @{ Authorization = "Bearer $adminToken" } -body "{}" | Out-Null
        Write-Host "[$i] $($booking.id): COMPLETED" -ForegroundColor Blue
      }
      3 {  # PENDING_PAYMENT
        Write-Host "[$i] $($booking.id): PENDING_PAYMENT" -ForegroundColor Magenta
      }
    }

    # Simulate some notifications being read
    try {
      Start-Sleep -Seconds 1
      $notifs = Invoke-RestMethod -Uri "$BaseUrl/notifications" -Method Get -Headers @{ Authorization = "Bearer $token" } -ErrorAction SilentlyContinue
      if ($notifs -and $notifs.items.Count -gt 0) {
        Invoke-RestMethod -Uri "$BaseUrl/notifications/mark-read" -Method Post `
          -Headers @{ Authorization = "Bearer $token" } `
          -ContentType "application/json" `
          -Body (@{ ids = @($notifs.items[0].id) } | ConvertTo-Json) `
          -ErrorAction SilentlyContinue | Out-Null
      }
    } catch {}

  } catch {
    Write-Host "ERROR on iteration $i : $_" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done! Fixture statuses: CONFIRMED, NO_SHOW, CANCELLED, REFUNDED/REFUND_PENDING, COMPLETED, PENDING_PAYMENT" -ForegroundColor Green
