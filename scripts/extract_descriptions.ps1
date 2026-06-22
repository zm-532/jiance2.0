# Extract B(device)/C(sample)/K(image_description) from xlsx, output JSON keyed by device_name+sample_name.
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$XLSX = "d:\中驰股份\声学检测\检测2.0\docs\检测项表单-实际图片-0618.xlsx"
$OUT  = "d:\中驰股份\声学检测\检测2.0\backend\data\image_descriptions.json"
$LOG  = "d:\中驰股份\声学检测\检测2.0\scripts\extract_desc_log.txt"

$MNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

$buf = New-Object System.Collections.ArrayList
function W($s="") { [void]$buf.Add("$s") }

$zip = [System.IO.Compression.ZipFile]::OpenRead($XLSX)
try {
    # sharedStrings
    $shared = @()
    $sse = $zip.GetEntry("xl/sharedStrings.xml")
    if ($sse) {
        $ssx = New-Object System.Xml.XmlDocument; $ssx.Load($sse.Open())
        $ssns = New-Object System.Xml.XmlNamespaceManager($ssx.NameTable); $ssns.AddNamespace("m",$MNS)
        foreach ($si in $ssx.SelectNodes("//m:si",$ssns)) {
            $t=""; foreach ($tn in $si.SelectNodes(".//m:t",$ssns)) { $t+=$tn.InnerText }
            $shared += $t
        }
    }
    W "sharedStrings: $($shared.Count)"

    # workbook sheets
    $wb = New-Object System.Xml.XmlDocument; $wb.Load($zip.GetEntry("xl/workbook.xml").Open())
    $wbns = New-Object System.Xml.XmlNamespaceManager($wb.NameTable)
    $wbns.AddNamespace("m",$MNS); $wbns.AddNamespace("r","http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $wbr = New-Object System.Xml.XmlDocument; $wbr.Load($zip.GetEntry("xl/_rels/workbook.xml.rels").Open())
    $wbrns = New-Object System.Xml.XmlNamespaceManager($wbr.NameTable); $wbrns.AddNamespace("rel","http://schemas.openxmlformats.org/package/2006/relationships")
    $ridToTarget = @{}
    foreach ($rel in $wbr.SelectNodes("//rel:Relationship",$wbrns)) { $ridToTarget[$rel.GetAttribute("Id")] = $rel.GetAttribute("Target") }

    $sheetList = @()
    foreach ($sh in $wb.SelectNodes("//m:sheet",$wbns)) {
        $nm = $sh.GetAttribute("name")
        $ridNode = $sh.SelectSingleNode("@r:id",$wbns)
        $rid = if ($ridNode) { $ridNode.Value } else { "" }
        $tgt = $ridToTarget[$rid]
        $path = if ($tgt) { ("xl/" + $tgt) } else { "" }
        $sheetList += [PSCustomObject]@{Name=$nm; File=$path}
    }

    # extract B/C/K per sheet
    $descMap = @{}  # key = "device_name||sample_name" -> description (first non-empty K)
    foreach ($sh in $sheetList) {
        if (-not $sh.File) { continue }
        $ent = $zip.GetEntry($sh.File)
        if (-not $ent) { continue }
        $sx = New-Object System.Xml.XmlDocument; $sx.Load($ent.Open())
        $sns = New-Object System.Xml.XmlNamespaceManager($sx.NameTable); $sns.AddNamespace("m",$MNS)

        # cell ref -> text
        $cells = @{}
        foreach ($c in $sx.SelectNodes("//m:c",$sns)) {
            $ref=$c.GetAttribute("r"); $t=$c.GetAttribute("t")
            $v=$c.SelectSingleNode("m:v",$sns); $val = if($v){$v.InnerText}else{""}
            $fNode = $c.SelectSingleNode("m:f",$sns)
            if ($fNode) { $val = $fNode.InnerText }  # formula text (DISPIMG)
            if ($t -eq "s" -and $val -and -not $fNode) { try { $val=$shared[[int]$val] } catch {} }
            if ($null -ne $val -and $val -ne "") { $cells[$ref] = $val }
        }
        W "$($sh.Name): $($cells.Count) cells"

        # find rows that have B (device) and K (description)
        # collect all row numbers from B column
        $bRows = @{}
        foreach ($k in $cells.Keys) {
            if ($k -match '^B(\d+)$') { $bRows[[int]$Matches[1]] = $cells[$k] }
        }
        foreach ($r in ($bRows.Keys | Sort-Object)) {
            $device = $bRows[$r]
            $sample = $cells["C$r"]
            $desc   = $cells["K$r"]
            if ($device -and $desc) {
                $key = "$device||$sample"
                if (-not $descMap.ContainsKey($key)) {
                    $descMap[$key] = $desc
                }
            }
        }
    }

    W "`n=== descriptions extracted: $($descMap.Count) ==="
    # build JSON output: [{device_name, sample_name, image_description}, ...]
    $list = @()
    foreach ($k in ($descMap.Keys | Sort-Object)) {
        $parts = $k -split '\|\|', 2
        $list += [PSCustomObject]@{
            device_name = $parts[0]
            sample_name = $parts[1]
            image_description = $descMap[$k]
        }
        W "  $($parts[0]) / $($parts[1])"
        W "    -> $($descMap[$k].Substring(0,[Math]::Min(80,$descMap[$k].Length)))..."
    }

    $list | ConvertTo-Json -Depth 3 | Out-File -FilePath $OUT -Encoding UTF8
    W "`nwritten: $OUT ($($list.Count) entries)"
} finally { $zip.Dispose() }

$buf | Out-File -FilePath $LOG -Encoding utf8
Write-Output "DONE entries=$($list.Count)"
