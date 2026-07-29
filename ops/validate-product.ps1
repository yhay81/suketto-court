[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PagesPath = Join-Path $RepoRoot "src\ui\pages.tsx"
$WorkerPath = Join-Path $RepoRoot "src\worker.tsx"
$MigrationPath = Join-Path $RepoRoot "migrations\0001_listings.sql"
$CommonPath = Join-Path $RepoRoot "public\common.js"
$ManagePath = Join-Path $RepoRoot "public\manage.js"
$ApplicationPath = Join-Path $RepoRoot "public\application.js"
$StylesPath = Join-Path $RepoRoot "public\styles.css"
$PublicDirectory = Join-Path $RepoRoot "public"

$RequiredFiles = @(
    "DECISIONS.md",
    "EXPERIMENT.md",
    "METRICS.md",
    "PRIVACY.md",
    "README.md",
    "SECURITY.md",
    "STACK.md",
    "public\application.js",
    "public\common.js",
    "public\home.js",
    "public\listing.js",
    "public\manage.js",
    "public\styles.css",
    "public\og.svg",
    "public\robots.txt",
    "public\sitemap.xml"
)
foreach ($RelativePath in $RequiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $RelativePath))) {
        throw "Missing required release file: $RelativePath"
    }
}

$Pages = Get-Content -Raw -LiteralPath $PagesPath
$Worker = Get-Content -Raw -LiteralPath $WorkerPath
$Migration = Get-Content -Raw -LiteralPath $MigrationPath
$Common = Get-Content -Raw -LiteralPath $CommonPath
$Manage = Get-Content -Raw -LiteralPath $ManagePath
$Application = Get-Content -Raw -LiteralPath $ApplicationPath
$Styles = Get-Content -Raw -LiteralPath $StylesPath
$ProductSurface = @($Pages, $Common, $Manage, $Application) -join "`n"

if ($Pages.Contains('class="hero"') -or $Pages.Contains('class="product-flow"')) {
    throw "Text-led hero and generic product-flow sections are not releaseable"
}
if (-not $Pages.Contains('class="court-stage"') -or
    -not $Pages.Contains('class="vacancy-board"') -or
    -not $Pages.Contains('class="helper-pair"') -or
    -not $Pages.Contains('class="entry-lane"')) {
    throw "Expected the court-to-vacancy-to-player visualization"
}
if (-not $Pages.Contains('id="create-form"') -or
    -not $Pages.Contains('id="apply-form"') -or
    -not $Pages.Contains('id="applicant-list"') -or
    -not $Pages.Contains('id="status-card"')) {
    throw "Expected create, apply, manage, and private status workspaces"
}
if ($ProductSurface -match '(?i)public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性') {
    throw "Research copy must not appear on the product surface"
}
if ($Styles -match '(?s)h1\s*\{[^}]*font-size:\s*(?:[4-9]\d|[1-9]\d{2})px') {
    throw "Primary heading is too large"
}
if ($ProductSurface -match '(?i)innerHTML|eval\(|new Function') {
    throw "User content must not be interpreted as markup or code"
}
if (-not $Common.Contains("location.hash") -or
    -not $Worker.Contains("owner_token_hash") -or
    -not $Worker.Contains("applicant_token_hash") -or
    -not $Worker.Contains('sha256(token)')) {
    throw "Capability URLs must keep raw tokens in fragments and store only hashes"
}
if (-not $Worker.Contains('application.status === "accepted" ? listing.join_instructions : ""')) {
    throw "Join instructions must be returned only to accepted applicants"
}
if (-not $Worker.Contains("constantTimeEqual") -or
    -not $Worker.Contains("enforceSameOrigin") -or
    -not $Worker.Contains("listing_rate_limited") -or
    -not $Worker.Contains("position_mismatch")) {
    throw "Expected capability, origin, rate, and position boundaries"
}
if (-not $Worker.Contains("45 * 86400") -or
    -not $Worker.Contains("DELETE FROM listings WHERE expires_at < unixepoch()") -or
    -not $Migration.Contains("ON DELETE CASCADE")) {
    throw "Expected bounded event and listing retention"
}
if ($Migration -match '(?i)email|phone|real_name|display_name|photo|gender|birthday|payment|message_thread') {
    throw "Identity, contact, profile, payment, and chat data do not belong in this release"
}
if (-not $Migration.Contains("CHECK(field_slots + keeper_slots > 0)") -or
    -not $Migration.Contains("UNIQUE(listing_id, session_id)") -or
    -not $Migration.Contains("assigned_position")) {
    throw "Expected slot, duplicate-application, and assignment constraints"
}
if ($Worker -match '(?i)better-auth|betterAuth') {
    throw "Account authentication is not needed for the capability-based release"
}

$OgPath = Join-Path $PublicDirectory "og.svg"
if ((Get-Item -LiteralPath $OgPath).Length -lt 3000) {
    throw "Expected a product-specific OG SVG larger than 3 KB"
}

$KeyFiles = @(
    Get-ChildItem -LiteralPath $PublicDirectory -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1) {
    throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)"
}
$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) {
    throw "IndexNow key file name and content do not match"
}

Write-Output "Product release contract is satisfied"
