# Run after: vercel login (and from project root)
# Pushes .env.local vars to Vercel and deploys production for Sri Palani Textiles.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

node scripts/validate-project-identity.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Error "project identity validation failed"
}

if (-not (Test-Path ".env.local")) {
  Write-Error ".env.local not found"
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$lines = Get-Content ".env.local" | Where-Object { $_ -match '^\s*[^#=]+\s*=' }
foreach ($line in $lines) {
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { continue }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if (-not $name) { continue }
  Write-Host "Setting $name ..."
  $value | vercel env add $name production --force 2>$null
  if ($LASTEXITCODE -ne 0) {
    $value | vercel env add $name production 2>$null
  }
}

Write-Host "Linking project (accept defaults if prompted)..."
vercel link --yes 2>$null
if ($LASTEXITCODE -ne 0) { vercel link }

Write-Host "Deploying to production..."
$deployUrl = (vercel deploy --prod --yes 2>&1 | Select-String -Pattern "https://\S+" | Select-Object -Last 1).ToString().Trim()
if ($deployUrl) {
  Write-Host "Deployed: $deployUrl"
}
Write-Host "Done. NEXT_PUBLIC_SITE_URL should stay pinned to the canonical production domain in project.identity.json."
