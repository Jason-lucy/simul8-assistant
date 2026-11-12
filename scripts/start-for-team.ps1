# Start Simul8 Assistant for LAN access (colleagues on same network)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Ensuring Postgres is up..."
docker compose up -d db

Write-Host "==> Waiting for DB..."
Start-Sleep -Seconds 3

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example — please edit secrets before production use."
}

Write-Host "==> Sync schema & seed admin/invite..."
npx prisma db push
npm run db:seed-admin

# Discover LAN IPv4
$ip = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "============================================"
Write-Host " Simul8 知识助手已准备启动"
Write-Host " 本机:   http://localhost:3000"
if ($ip) { Write-Host " 局域网: http://${ip}:3000" }
Write-Host " 管理员见 .env 中 ADMIN_EMAIL / ADMIN_PASSWORD"
Write-Host " 邀请码默认: SIMUL8-WELCOME （也可在管理后台再生成）"
Write-Host " 每人注册后需自行填写 LLM API Key"
Write-Host "============================================"
Write-Host ""

$env:HOSTNAME = "0.0.0.0"
npm run dev -- -H 0.0.0.0 -p 3000
