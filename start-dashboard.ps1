param([int]$Port = 3000)

$ErrorActionPreference = "Stop"
$web = Join-Path $PSScriptRoot "web"
if (-not (Test-Path -LiteralPath (Join-Path $web "node_modules"))) {
  throw "Dependencies are missing. Run npm install in $web first."
}

Push-Location $web
try {
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Dashboard build failed." }
  npm.cmd run start -- -p $Port
} finally {
  Pop-Location
}
