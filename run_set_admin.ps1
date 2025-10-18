<#
run_set_admin.ps1
Helper PowerShell script to run set_admin.js with the required arguments.
Usage: Open PowerShell, cd to d:\Site, then:

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
.\run_set_admin.ps1 -ServiceAccountPath "C:\path\to\serviceAccount.json" -UserUid "<USER_UID>"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountPath,
    [Parameter(Mandatory=$true)]
    [string]$UserUid
)

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "Node.js nu pare instalat. Instalează Node.js înainte de a continua: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "=== Set admin claim helper ===" -ForegroundColor Green
Ensure-Node

$scriptPath = Join-Path (Get-Location) 'set_admin.js'
if (-not (Test-Path $scriptPath)) {
    Write-Host "Fișierul set_admin.js nu există în directorul curent." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ServiceAccountPath)) {
    Write-Host "Service account file not found: $ServiceAccountPath" -ForegroundColor Red
    exit 1
}

Write-Host "Instalare dependințe (firebase-admin)..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path (Get-Location) 'node_modules\firebase-admin'))) {
    npm init -y > $null 2>&1
    npm install firebase-admin > $null 2>&1
}

Write-Host "Rulez: node $scriptPath $ServiceAccountPath $UserUid" -ForegroundColor Cyan
node $scriptPath $ServiceAccountPath $UserUid

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ set_admin.js rulat cu succes. Asigură-te că utilizatorul se deconectează și reconectează." -ForegroundColor Green
} else {
    Write-Host "❌ Eroare la rularea set_admin.js. Vezi output-ul de mai sus." -ForegroundColor Red
}
