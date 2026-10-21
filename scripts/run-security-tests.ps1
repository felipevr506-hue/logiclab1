$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$tempPath = Join-Path $projectRoot ".tmp"
New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
$env:TEMP = $tempPath
$env:TMP = $tempPath
Set-Location $projectRoot

& node --require ./scripts/windows-node-test-shim.cjs --import tsx --conditions=react-server --test tests/security/policies.test.ts tests/security/account-storage.test.ts tests/security/auth-lifecycle.test.ts tests/security/server-progress.test.ts tests/security/dashboard-view.test.ts tests/security/tutor-pedagogy.test.ts tests/security/tutor-chat.test.ts
exit $LASTEXITCODE
