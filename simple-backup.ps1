# Simple Myriad Green Site Backup Script
param(
    [string]$BackupLocation = "D:\Backups\myriad-green"
)

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$backupName = "myriad-green-backup-$timestamp"
$backupPath = Join-Path $BackupLocation $backupName

Write-Host "Creating backup: $backupPath" -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

# Copy source files (exclude large/temp directories)
Write-Host "Copying source files..." -ForegroundColor Yellow
$excludePatterns = @("node_modules", ".git", "*.log", ".history", "dist", "build")

# Get all items and filter
$items = Get-ChildItem -Path "." | Where-Object { 
    $item = $_
    $shouldExclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($item.Name -like $pattern) {
            $shouldExclude = $true
            break
        }
    }
    -not $shouldExclude
}

foreach ($item in $items) {
    $dest = Join-Path $backupPath $item.Name
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination $dest -Recurse -Force
    } else {
        Copy-Item -Path $item.FullName -Destination $dest -Force
    }
    Write-Host "  Copied: $($item.Name)" -ForegroundColor Gray
}

# Create git info
Write-Host "Saving git information..." -ForegroundColor Yellow
$gitCommit = git rev-parse HEAD 2>$null
$gitBranch = git rev-parse --abbrev-ref HEAD 2>$null
"Git Commit: $gitCommit`nGit Branch: $gitBranch`nBackup Date: $(Get-Date)" | Out-File -FilePath (Join-Path $backupPath "backup-info.txt")

# Create simple readme
Write-Host "Creating restoration guide..." -ForegroundColor Yellow
$readme = @"
# Myriad Green Backup - $timestamp

## Contents
- Complete source code (excluding node_modules, .git, logs)
- All configuration files
- Documentation and scripts

## To Restore
1. Copy all files to target directory
2. Run: npm install
3. Copy .env.example to .env and configure
4. See DEVELOPMENT-SETUP.md for detailed setup

## Last Commit
$gitCommit ($gitBranch)

## Backup Date  
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$readme | Out-File -FilePath (Join-Path $backupPath "README.txt") -Encoding UTF8

$backupSize = (Get-ChildItem -Path $backupPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "Location: $backupPath" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Cyan