# Video Merger — Windows prerequisites check (development / lite builds)
$ErrorActionPreference = "Stop"

Write-Host "Video Merger — prerequisites check" -ForegroundColor Cyan

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (Test-Command ffmpeg) {
  Write-Host "ffmpeg is installed." -ForegroundColor Green
  ffmpeg -version | Select-Object -First 1
  exit 0
}

Write-Host "ffmpeg was not found on PATH." -ForegroundColor Yellow
if (Test-Command winget) {
  Write-Host "Install with: winget install --id Gyan.FFmpeg -e" -ForegroundColor Yellow
} else {
  Write-Host "Install winget or download FFmpeg from https://ffmpeg.org/download.html" -ForegroundColor Yellow
}
Write-Host "Fat Windows installers bundle FFmpeg and do not require a separate install." -ForegroundColor Gray
exit 1
