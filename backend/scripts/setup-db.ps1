if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/project_cnm?schema=public'
}

npx.cmd prisma db push --schema backend/prisma/schema.prisma --accept-data-loss
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node backend/prisma/seed.js
