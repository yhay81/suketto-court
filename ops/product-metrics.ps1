[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute suketto-court $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Creators = [int]$Row.creators
$Openers = [int]$Row.openers
$Applicants = [int]$Row.applicants

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "suketto-court"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        creators = $Creators
        openers = $Openers
        applicants = $Applicants
        accepted = [int]$Row.accepted
        filled_organizers = [int]$Row.filled_organizers
        returned = [int]$Row.returned
        users_7d = [int]$Row.users_7d
        creators_7d = [int]$Row.creators_7d
        applicants_7d = [int]$Row.applicants_7d
    }
    live_state = [ordered]@{
        future_listings = [int]$Row.future_listings
        pending_applications = [int]$Row.pending_applications
        accepted_applications = [int]$Row.accepted_applications
    }
    rates = [ordered]@{
        creator_percent = Get-Percent $Creators $Users
        listing_open_percent = Get-Percent $Openers $Users
        applicant_percent = Get-Percent $Applicants $Openers
        acceptance_percent = Get-Percent ([int]$Row.accepted) $Applicants
        return_percent = Get-Percent ([int]$Row.returned) $Users
    }
} | ConvertTo-Json -Depth 4
