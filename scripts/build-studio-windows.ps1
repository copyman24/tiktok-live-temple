$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    # Reuse the prayer app's Windows sidecar build for the ZeroTTS (Mai Chi) worker.
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts/build-windows-sidecars.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'The ZeroTTS sidecar build failed.' }
    & bun (Join-Path $repoRoot 'scripts/build-studio-backend.js')
    if ($LASTEXITCODE -ne 0) { throw 'Bun could not build the studio backend sidecar.' }
    Write-Output 'Built the TikTok Live Studio backend and ZeroTTS sidecars.'
} finally {
    Pop-Location
}
