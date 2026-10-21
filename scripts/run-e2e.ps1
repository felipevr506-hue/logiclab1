param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArgs
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$browserPath = Join-Path $projectRoot ".playwright-browsers"
$tempPath = Join-Path $projectRoot ".tmp"
$testDataNamespace = "e2e-data-" + [Guid]::NewGuid().ToString("N")
$testDataPath = Join-Path $tempPath $testDataNamespace
$testPort = if ($env:E2E_PORT) { $env:E2E_PORT } else { "3199" }
$baseUrl = "http://127.0.0.1:$testPort"
$server = $null
$ownsServer = $false
$exitCode = 1

New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
New-Item -ItemType Directory -Force -Path $testDataPath | Out-Null
$env:PLAYWRIGHT_BROWSERS_PATH = $browserPath
$env:TEMP = $tempPath
$env:TMP = $tempPath
$env:PLAYWRIGHT_BASE_URL = $baseUrl
$env:APP_ENV = "test"
$env:AUTH_MODE = "demo"
$env:AUTH_EMAIL_DELIVERY = "console"
$env:BILLING_PROVIDER = "hotmart"
$env:HOTMART_WEBHOOK_SECRET = "e2e-hottok-not-a-production-secret"
$env:TEST_AUTH_ROLE = "ADMIN"
$env:NEXT_PUBLIC_BROWSER_EXECUTOR_ENABLED = "true"
$env:NEXT_DIST_DIR = ".next-test"
$env:LOGICLAB_DATA_NAMESPACE = $testDataNamespace
Set-Location $projectRoot

try {
  $serverReady = $false
  try {
    $status = Invoke-WebRequest -Uri "$baseUrl/api/status" -UseBasicParsing -TimeoutSec 2
    $serverReady = $status.StatusCode -eq 200
  } catch {
    $serverReady = $false
  }

  if (-not $serverReady) {
    $server = Start-Process -FilePath "node" -ArgumentList "node_modules/next/dist/bin/next", "dev", "-p", $testPort -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    $ownsServer = $true
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
      Start-Sleep -Milliseconds 250
      try {
        $status = Invoke-WebRequest -Uri "$baseUrl/api/status" -UseBasicParsing -TimeoutSec 2
        if ($status.StatusCode -eq 200) { $serverReady = $true; break }
      } catch {
        if ($server.HasExited) { throw "O servidor de produção encerrou antes de ficar pronto." }
      }
    }
    if (-not $serverReady) { throw "O servidor de produção não respondeu no tempo esperado." }
  }

  & (Join-Path $projectRoot "node_modules/.bin/playwright.cmd") test @PlaywrightArgs
  $exitCode = $LASTEXITCODE
} finally {
  if ($ownsServer -and $null -ne $server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  $resolvedTemp = [System.IO.Path]::GetFullPath($tempPath).TrimEnd('\')
  $resolvedTestData = [System.IO.Path]::GetFullPath($testDataPath)
  if (-not $resolvedTestData.StartsWith($resolvedTemp + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "DiretÃ³rio de teste fora da pasta temporÃ¡ria esperada: $resolvedTestData"
  }
  if (Test-Path -LiteralPath $resolvedTestData) {
    Remove-Item -LiteralPath $resolvedTestData -Recurse -Force
  }
}

exit $exitCode
