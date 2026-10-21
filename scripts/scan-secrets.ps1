$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$patterns = [ordered]@{
  private_key = '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
  openai_key = 'sk-(proj-)?[A-Za-z0-9_-]{20,}'
  github_token = 'gh[pousr]_[A-Za-z0-9]{20,}'
  jwt = 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  aws_key = 'AKIA[0-9A-Z]{16}'
  bearer_token = '(?i)bearer\s+[A-Za-z0-9._~+/-]{20,}'
  credential_url = '(?i)(postgres|mysql|mongodb(?:\+srv)?)://[^\s"'']+:[^\s"'']+@'
}

$roots = @("app", "components", "docs", "lib", "prisma", "scripts", "services", "tests", ".github")
$files = @()
foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root) {
    $files += Get-ChildItem -LiteralPath $root -Recurse -File
  }
}
$files += Get-ChildItem -File | Where-Object {
  $_.Name -notmatch '\.(log|tsbuildinfo)$' -and $_.Name -ne ".env.example"
}

$findings = @()
foreach ($file in $files) {
  foreach ($kind in $patterns.Keys) {
    $matches = Select-String -LiteralPath $file.FullName -Pattern $patterns[$kind] -AllMatches
    foreach ($match in $matches) {
      $relative = $file.FullName.Substring($projectRoot.Length + 1)
      $findings += "$kind $relative`:$($match.LineNumber)"
    }
  }
}

if ($findings.Count -gt 0) {
  Write-Error ("PossÃ­veis segredos encontrados (valores ocultos):`n" + ($findings -join "`n"))
  exit 1
}

Write-Output "Nenhum candidato a segredo foi encontrado nos arquivos versionÃ¡veis."
