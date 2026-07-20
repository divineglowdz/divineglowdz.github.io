param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$SupabaseAnonKey,
  [Parameter(Mandatory = $true)][string]$SupabaseEmail,
  [Parameter(Mandatory = $true)][string]$SupabasePassword,
  [Parameter(Mandatory = $true)][string]$FirebaseApiKey,
  [Parameter(Mandatory = $true)][string]$FirebaseProjectId,
  [Parameter(Mandatory = $true)][string]$FirebaseEmail,
  [Parameter(Mandatory = $true)][string]$FirebasePassword
)

function ConvertTo-FirestoreValue($Value) {
  if ($null -eq $Value) { return @{ nullValue = $null } }
  if ($Value -is [bool]) { return @{ booleanValue = $Value } }
  if ($Value -is [string]) { return @{ stringValue = $Value } }
  if ($Value -is [int] -or $Value -is [long]) { return @{ integerValue = [string]$Value } }
  if ($Value -is [float] -or $Value -is [double] -or $Value -is [decimal]) { return @{ doubleValue = [double]$Value } }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    return @{ arrayValue = @{ values = @($Value | ForEach-Object { ConvertTo-FirestoreValue $_ }) } }
  }
  $fields = @{}
  $Value.PSObject.Properties | ForEach-Object { $fields[$_.Name] = ConvertTo-FirestoreValue $_.Value }
  return @{ mapValue = @{ fields = $fields } }
}

function Copy-Orders($Rows, $Headers, $ProjectId) {
  foreach ($order in @($Rows)) {
    if ($null -eq $order) { continue }
    $fields = @{}
    $order.PSObject.Properties | ForEach-Object { $fields[$_.Name] = ConvertTo-FirestoreValue $_.Value }
    $body = @{ fields = $fields } | ConvertTo-Json -Depth 100 -Compress
    $url = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents/orders/$($order.id)"
    Invoke-RestMethod -Method Patch -Headers $Headers -ContentType 'application/json' -Body $body -Uri $url | Out-Null
  }
}

$supabaseAuthPayload = @{ email = $SupabaseEmail; password = $SupabasePassword } | ConvertTo-Json
$supabaseAuth = Invoke-RestMethod -Method Post -ContentType 'application/json' -Headers @{ apikey = $SupabaseAnonKey } -Body $supabaseAuthPayload -Uri "$SupabaseUrl/auth/v1/token?grant_type=password"
$sourceHeaders = @{ apikey = $SupabaseAnonKey; Authorization = "Bearer $($supabaseAuth.access_token)" }

$firebaseAuthPayload = @{ email = $FirebaseEmail; password = $FirebasePassword; returnSecureToken = $true } | ConvertTo-Json
$firebaseAuth = Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $firebaseAuthPayload -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FirebaseApiKey"
$targetHeaders = @{ Authorization = "Bearer $($firebaseAuth.idToken)" }

$orders = Invoke-RestMethod -Headers $sourceHeaders -Uri "$SupabaseUrl/rest/v1/orders?select=*,order_items(*)&order=created_at.desc"
if ($null -eq $orders) { $orders = @() }

Copy-Orders $orders $targetHeaders $FirebaseProjectId
[PSCustomObject]@{ orders = @($orders).Count; statuses = @($orders | Group-Object status | ForEach-Object { @{ status = $_.Name; count = $_.Count } }) } | ConvertTo-Json -Depth 5 -Compress
