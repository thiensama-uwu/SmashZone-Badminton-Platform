$services = @(
  @{ Name = 'user'; Dir = 'backend/user-service'; Port = 3002 },
  @{ Name = 'auth'; Dir = 'backend/auth-service'; Port = 3001 },
  @{ Name = 'court'; Dir = 'backend/court-service'; Port = 3003 },
  @{ Name = 'booking'; Dir = 'backend/booking-service'; Port = 3004 },
  @{ Name = 'payment'; Dir = 'backend/payment-service'; Port = 3005 },
  @{ Name = 'notification'; Dir = 'backend/notification-service'; Port = 3006 },
  @{ Name = 'report'; Dir = 'backend/report-service'; Port = 3007 },
  @{ Name = 'gateway'; Dir = 'backend/api-gateway'; Port = 3000 }
)

foreach ($service in $services) {
  Start-Process node -ArgumentList './bin/www' -WorkingDirectory $service.Dir | Out-Null
  Write-Host "Started $($service.Name) on port $($service.Port)"
}
