# Generate INSERT SQL from test_item_configs.json (no Python needed).
$ErrorActionPreference = 'Stop'
$JSON = "d:\中驰股份\声学检测\检测2.0\backend\data\test_item_configs.json"
$OUT  = "d:\中驰股份\声学检测\检测2.0\scripts\config_data.sql"

function Esc([string]$s) { return ($s -replace "'", "''") }
function Q([string]$s) { return "'" + (Esc $s) + "'" }   # quoted string literal

$items = Get-Content $JSON -Raw -Encoding UTF8 | ConvertFrom-Json
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add("SET NAMES utf8mb4;")
[void]$lines.Add("SET @now = NOW();")
[void]$lines.Add("TRUNCATE TABLE test_item_configs;")

foreach ($it in $items) {
  $rule = $it.extraction_rule | ConvertTo-Json -Compress -Depth 10
  # JSON 内的反斜杠在 SQL 字符串字面量中需再次转义：\ -> \\
  $rule = $rule -replace '\\', '\\\\'
  $subItem = if ($it.sub_item) { $it.sub_item } else { "" }
  $jind    = if ($it.judgment_indicator) { $it.judgment_indicator } else { "" }
  $tstd    = if ($it.test_standard) { $it.test_standard } else { "" }
  $rsec    = if ($it.report_section) { $it.report_section } else { "" }

  # build value list: strings quoted, numbers bare
  $vals = @(
    (Q $it.id), (Q $it.device_name), (Q $it.device_key), (Q $it.sample_name),
    (Q $it.material_spec), (Q $it.judgment_standard), (Q $it.group_key),
    [int]$it.group_item_count,
    (Q $it.test_item), (Q $subItem), (Q $jind), (Q $tstd),
    (Q $rule), (Q $it.aggregation_method), [int]$it.sample_count,
    [int]$it.needs_subtable, (Q $rsec)
  ) -join ","
  $sql = "INSERT INTO test_item_configs (id,device_name,device_key,sample_name,material_spec,judgment_standard,group_key,group_item_count,test_item,sub_item,judgment_indicator,test_standard,extraction_rule,aggregation_method,sample_count,needs_subtable,report_section,created_at,updated_at) VALUES ($vals,@now,@now);"
  [void]$lines.Add($sql)
}
[void]$lines.Add("SELECT COUNT(*) AS imported FROM test_item_configs;")

$lines | Out-File -FilePath $OUT -Encoding UTF8
Write-Output "GENERATED rows=$($items.Count)"
