<#
deploy_rules.ps1
Helper to deploy Realtime Database rules (database.rules.json) using Firebase CLI.
Usage: Open PowerShell as your user, cd to d:\Site, then:

# allow running this script for this session
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
.\deploy_rules.ps1

The script will ensure firebase-tools is installed, prompt for project id (default: votes-7e548), and deploy the database rules.
#>

Param()

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "Node.js nu pare instalat. Instalează Node.js înainte de a continua: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
}

function Ensure-FirebaseCLI {
    $fb = Get-Command firebase -ErrorAction SilentlyContinue
    if (-not $fb) {
        Write-Host "firebase-tools nu este instalat global. Instalare... (poate necesita permisiuni de admin)" -ForegroundColor Cyan
        npm install -g firebase-tools
        $fb = Get-Command firebase -ErrorAction SilentlyContinue
        if (-not $fb) { Write-Host "Instalarea firebase-tools a eșuat. Rulează manual: npm install -g firebase-tools" -ForegroundColor Red; exit 1 }
    }
}

Write-Host "=== Deploy Realtime Database rules helper ===" -ForegroundColor Green
Ensure-Node
Ensure-FirebaseCLI

$defaultProject = 'votes-7e548'
$projectId = Read-Host "Project ID pentru deploy (apasă Enter pentru '$defaultProject')"
if ([string]::IsNullOrWhiteSpace($projectId)) { $projectId = $defaultProject }

$rulesFile = Join-Path (Get-Location) 'database.rules.json'
if (-not (Test-Path $rulesFile)) {
    Write-Host "Fișierul database.rules.json nu a fost găsit în $(Get-Location). Creează-l sau rulează din directorul corect." -ForegroundColor Red
    exit 1
}

Write-Host "Autentificare Firebase (dacă nu ești deja logat)..." -ForegroundColor Cyan
firebase login

Write-Host "Public regula database.rules.json pentru proiectul: $projectId" -ForegroundColor Green
firebase deploy --only database --project $projectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deploy complet." -ForegroundColor Green
} else {
    Write-Host "❌ Deploy eșuat. Verifică mesajele de mai sus." -ForegroundColor Red
}
