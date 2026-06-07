$ErrorActionPreference = 'Stop'

$securePassword = Read-Host 'Contraseña del usuario postgres' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $envContent = @"
DATABASE_URL=postgresql://postgres:$encodedPassword@localhost:5432/cash_food
PORT=3000
"@
  Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\.env') -Value $envContent -Encoding UTF8
  Write-Host 'Configuración guardada. Creando la base de datos...' -ForegroundColor Green
  Set-Location (Join-Path $PSScriptRoot '..')
  npm run db:init
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo crear la base de datos. Verifica la contraseña e inténtalo otra vez.'
  }
  Write-Host 'Base de datos lista. Ya puedes ejecutar npm start.' -ForegroundColor Green
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
