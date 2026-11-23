param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting E2E Smoke Test..." -ForegroundColor Cyan

$Guid = [guid]::NewGuid().ToString()
$Email = "smoke.user.$Guid@example.com"
$Password = "Password@123"

Write-Host "1. Registering user ($Email)... " -NoNewline
$registerBody = @{ email = $Email; password = $Password; fullName = "Smoke User $Guid" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType "application/json" -Body $registerBody | Out-Null
Write-Host "OK" -ForegroundColor Green

Write-Host "2. Logging in... " -NoNewline
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody
Write-Host "OK" -ForegroundColor Green

Write-Host "3. Fetching courts... " -NoNewline
$courts = Invoke-RestMethod -Method Get -Uri "$BaseUrl/courts"
if ($courts.items.Count -eq 0) {
  Write-Host "FAIL (No courts found)" -ForegroundColor Red
  exit 1
}
$courtId = $courts.items[0].id
Write-Host "OK (Court ID: $courtId)" -ForegroundColor Green

Write-Host "4. Holding booking slot... " -NoNewline
# Use tomorrow's date and a random hour to avoid SLOT_UNAVAILABLE conflicts from prior test runs
$tomorrow = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$randomHour = Get-Random -Minimum 7 -Maximum 20
$startTime = "{0:D2}:00" -f $randomHour
$endTime   = "{0:D2}:00" -f ($randomHour + 1)
$holdBody = @{ courtId = $courtId; date = $tomorrow; startTime = $startTime; endTime = $endTime; paymentScenario = @{ providerStatus = "success"; autoWebhook = $false } } | ConvertTo-Json -Depth 5
$holdIdempotencyKey = "smoke-hold-$Guid"
$hold = Invoke-RestMethod -Method Post -Uri "$BaseUrl/bookings/hold" -Headers @{ Authorization = "Bearer $($login.accessToken)"; 'Idempotency-Key' = $holdIdempotencyKey } -ContentType "application/json" -Body $holdBody
Write-Host "OK" -ForegroundColor Green

Write-Host "5. Creating booking... " -NoNewline
$createBody = @{ bookingId = $hold.booking.id } | ConvertTo-Json
$booking = Invoke-RestMethod -Method Post -Uri "$BaseUrl/bookings" -Headers @{ Authorization = "Bearer $($login.accessToken)" } -ContentType "application/json" -Body $createBody
Write-Host "OK (Booking ID: $($booking.id))" -ForegroundColor Green

Write-Host "6. Initiating payment... " -NoNewline
$paymentBody = @{ bookingId = $booking.id; totalAmount = $booking.totalAmount; paymentScenario = @{ providerStatus = "success"; autoWebhook = $false } } | ConvertTo-Json -Depth 5
$payIdempotencyKey = "smoke-pay-$Guid"
$payment = Invoke-RestMethod -Method Post -Uri "$BaseUrl/payments" -Headers @{ Authorization = "Bearer $($login.accessToken)"; 'Idempotency-Key' = $payIdempotencyKey } -ContentType "application/json" -Body $paymentBody
Write-Host "OK (Payment ID: $($payment.id))" -ForegroundColor Green

Write-Host "7. Signing & processing webhook... " -NoNewline
$signBody = @{ paymentId = $payment.id; status = "success"; providerTransactionId = "PTRX-$Guid" } | ConvertTo-Json
$sign = Invoke-RestMethod -Method Post -Uri "$BaseUrl/payments/webhook/mock/sign" -ContentType "application/json" -Body $signBody
Invoke-RestMethod -Method Post -Uri "$BaseUrl/payments/webhook/mock" -Headers @{ 'x-mock-signature' = $sign.signature } -ContentType "application/json" -Body $signBody | Out-Null
Write-Host "OK" -ForegroundColor Green

Write-Host "8. Waiting for event propagation... " -NoNewline
Start-Sleep -Seconds 1
Write-Host "Done" -ForegroundColor Green

Write-Host "9. Verifying history & notifications... " -NoNewline
$history = Invoke-RestMethod -Method Get -Uri "$BaseUrl/bookings/history" -Headers @{ Authorization = "Bearer $($login.accessToken)" }
$notifications = Invoke-RestMethod -Method Get -Uri "$BaseUrl/notifications" -Headers @{ Authorization = "Bearer $($login.accessToken)" }

if ($history.items.Count -eq 0) {
  Write-Host "FAIL (No booking history)" -ForegroundColor Red
  exit 1
}

Write-Host "OK" -ForegroundColor Green

Write-Host "`nTest Summary:" -ForegroundColor Cyan
[PSCustomObject]@{
  UserEmail = $Email
  BookingId = $booking.id
  PaymentId = $payment.id
  BookingCount = $history.items.Count
  NotificationCount = $notifications.items.Count
  Status = "PASS"
} | Format-Table -AutoSize
