$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
    if ($env:OS -ne 'Windows_NT') {
        throw 'This script must run in native Windows. WSL cannot build the Windows ZeroTTS executable; run bun run tauri:build from a Windows terminal.'
    }
    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
        throw 'Bun is required to build the backend sidecar.'
    }
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw 'uv is required to build the ZeroTTS sidecar.'
    }

    $venvPython = Join-Path $repoRoot '.venv/Scripts/python.exe'
    if (-not (Test-Path $venvPython)) {
        & uv venv .venv --python 3.11
        if ($LASTEXITCODE -ne 0) { throw 'uv could not create the Python 3.11 environment.' }
    }
    $pythonVersion = & $venvPython -c 'import sys; print(sys.version_info.major, sys.version_info.minor, sep=chr(46))'
    if ($LASTEXITCODE -ne 0 -or $pythonVersion -ne '3.11') {
        throw "The ZeroTTS build requires Python 3.11; found $pythonVersion. Recreate .venv with 'uv venv .venv --python 3.11'."
    }

    & uv pip install --python $venvPython zerotts pillow pyinstaller
    if ($LASTEXITCODE -ne 0) { throw 'uv could not install ZeroTTS and PyInstaller.' }

    & bun run scripts/build-backend.js
    if ($LASTEXITCODE -ne 0) { throw 'Bun could not build the Windows backend sidecar.' }

    $binaryDir = Join-Path $repoRoot 'src-tauri/binaries'
    $workDir = Join-Path $repoRoot '.cache/pyinstaller'
    & $venvPython -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --name zerotts-worker `
        --distpath $binaryDir `
        --workpath $workDir `
        --collect-all zerotts `
        --copy-metadata zerotts `
        tts_worker.py
    if ($LASTEXITCODE -ne 0) { throw 'PyInstaller could not build the ZeroTTS sidecar.' }

    $workerPath = Join-Path $binaryDir 'zerotts-worker.exe'
    if (-not (Test-Path $workerPath)) { throw 'PyInstaller did not produce zerotts-worker.exe.' }
    $workerBytes = [System.IO.File]::ReadAllBytes($workerPath)
    $peOffset = if ($workerBytes.Length -ge 64) { [BitConverter]::ToInt32($workerBytes, 0x3c) } else { -1 }
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $workerBytes.Length -or
        $workerBytes[0] -ne 0x4d -or $workerBytes[1] -ne 0x5a -or
        $workerBytes[$peOffset] -ne 0x50 -or $workerBytes[$peOffset + 1] -ne 0x45 -or
        $workerBytes[$peOffset + 2] -ne 0 -or $workerBytes[$peOffset + 3] -ne 0 -or
        $workerBytes[$peOffset + 4] -ne 0x64 -or $workerBytes[$peOffset + 5] -ne 0x86) {
        throw 'PyInstaller output is not an x64 Windows executable.'
    }

    Write-Output 'Built the Windows Bun backend and ZeroTTS sidecars.'
} finally {
    Pop-Location
}
