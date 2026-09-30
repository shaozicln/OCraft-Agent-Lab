# 本机（Windows + Docker Desktop）构建并推送到阿里云 ACR
# 用法（PowerShell，在仓库根目录）：
#   $env:ACR="registry.cn-hangzhou.aliyuncs.com/你的命名空间"
#   $env:TAG="20260930"
#   .\scripts\push-acr.ps1

$ErrorActionPreference = "Stop"

if (-not $env:ACR) {
  Write-Host '请先设置 $env:ACR，例如 registry.cn-hangzhou.aliyuncs.com/your-ns'
  exit 1
}
if (-not $env:TAG) { $env:TAG = Get-Date -Format "yyyyMMdd-HHmm" }

$ServerImg = "$($env:ACR)/ocraft-server:$($env:TAG)"
$ClientImg = "$($env:ACR)/ocraft-client:$($env:TAG)"
$GameUrl = if ($env:GAME_URL) { $env:GAME_URL } else { "https://ocraft.cspona.top" }

Write-Host "Building $ServerImg (linux/amd64) ..."
docker buildx build --platform linux/amd64 `
  -f docker/server.Dockerfile `
  -t $ServerImg `
  --push `
  .

Write-Host "Building $ClientImg (linux/amd64) NEXT_PUBLIC=$GameUrl ..."
docker buildx build --platform linux/amd64 `
  -f docker/client.Dockerfile `
  --build-arg "NEXT_PUBLIC_GAME_SERVER_URL=$GameUrl" `
  -t $ClientImg `
  --push `
  .

Write-Host "Done. On server:"
Write-Host "  export ACR=$($env:ACR)"
Write-Host "  export TAG=$($env:TAG)"
Write-Host "  docker compose -f docker-compose.prod.images.yml pull"
Write-Host "  docker compose -f docker-compose.prod.images.yml up -d"
