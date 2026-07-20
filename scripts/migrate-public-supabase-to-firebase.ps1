param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$SupabaseAnonKey,
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

$authPayload = @{ email = $FirebaseEmail; password = $FirebasePassword; returnSecureToken = $true } | ConvertTo-Json
$authBytes = [System.Text.Encoding]::UTF8.GetBytes($authPayload)
$auth = Invoke-RestMethod -Method Post -ContentType 'application/json; charset=utf-8' -Body $authBytes -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FirebaseApiKey"
$supabaseHeaders = @{ apikey = $SupabaseAnonKey; Authorization = "Bearer $SupabaseAnonKey" }
$firestoreHeaders = @{ Authorization = "Bearer $($auth.idToken)" }

$products = Invoke-RestMethod -Headers $supabaseHeaders -Uri "$SupabaseUrl/rest/v1/products?select=*,product_images(*),product_variants(*)&order=created_at.asc"
$deliveryRates = Invoke-RestMethod -Headers $supabaseHeaders -Uri "$SupabaseUrl/rest/v1/delivery_rates?select=*&order=wilaya_code.asc"

if ($null -eq $products -or $null -eq $deliveryRates) { throw 'Supabase did not return the source data.' }

function Copy-Documents($Collection, $Rows, $IdProperty) {
  foreach ($row in @($Rows)) {
    if ($null -eq $row) { continue }
    $id = [string]$row.$IdProperty
    $fields = @{}
    $row.PSObject.Properties | ForEach-Object { $fields[$_.Name] = ConvertTo-FirestoreValue $_.Value }
    $body = @{ fields = $fields } | ConvertTo-Json -Depth 100 -Compress
    $url = "https://firestore.googleapis.com/v1/projects/$FirebaseProjectId/databases/(default)/documents/$Collection/$id"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    Invoke-RestMethod -Method Patch -Headers $firestoreHeaders -ContentType 'application/json; charset=utf-8' -Body $bodyBytes -Uri $url | Out-Null
  }
}

Copy-Documents 'products' $products 'id'
Copy-Documents 'delivery_rates' $deliveryRates 'wilaya_code'
[PSCustomObject]@{ products = @($products).Count; delivery_rates = @($deliveryRates).Count } | ConvertTo-Json -Compress
