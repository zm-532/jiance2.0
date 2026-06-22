# Final extraction: map images to device/sample via WPS DISPIMG + cellimages.xml.
# Produces meaningfully named files in docs/test-img + a manifest.
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$XLSX = "d:\中驰股份\声学检测\检测2.0\docs\检测项表单-实际图片-0618.xlsx"
$OUT  = "d:\中驰股份\声学检测\检测2.0\docs\test-img"
$LOGF = "d:\中驰股份\声学检测\检测2.0\scripts\extract_final_log.txt"

# clean previous misc_* outputs
if (Test-Path $OUT) { Get-ChildItem $OUT -File | Remove-Item -Force }
else { New-Item -ItemType Directory -Path $OUT -Force | Out-Null }

$buf = New-Object System.Collections.ArrayList
function W($s="") { [void]$buf.Add("$s") }

$MNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
$RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
$PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
$XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
$ANS = "http://schemas.openxmlformats.org/drawingml/2006/main"
$ETC = "http://www.wps.cn/officeDocument/2017/etCustomData"

$zip = [System.IO.Compression.ZipFile]::OpenRead($XLSX)
try {
    # ---- sharedStrings ----
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

    # ---- cellimages.xml : DISPIMG ID -> rId ----
    $idToMedia = @{}
    $ciEntry = $zip.GetEntry("xl/cellimages.xml")
    if ($ciEntry) {
        $ci = New-Object System.Xml.XmlDocument; $ci.Load($ciEntry.Open())
        $cins = New-Object System.Xml.XmlNamespaceManager($ci.NameTable)
        $cins.AddNamespace("etc",$ETC); $cins.AddNamespace("xdr",$XDR); $cins.AddNamespace("a",$ANS); $cins.AddNamespace("r",$RNS)
        # cNvPr name = DISPIMG id ; a:blip r:embed = rId
        $pics = $ci.SelectNodes("//xdr:pic",$cins)
        W "cellimages pics: $($pics.Count)"
        # cellimages rels
        $ciRels = $zip.GetEntry("xl/_rels/cellimages.xml.rels")
        $rIdToMedia = @{}
        if ($ciRels) {
            $cr = New-Object System.Xml.XmlDocument; $cr.Load($ciRels.Open())
            $crns = New-Object System.Xml.XmlNamespaceManager($cr.NameTable); $crns.AddNamespace("rel",$PKG)
            foreach ($rel in $cr.SelectNodes("//rel:Relationship",$crns)) {
                $tgt = $rel.GetAttribute("Target")
                if ($tgt -like "/*") { $tgt = $tgt.TrimStart("/") }
                elseif ($tgt -like "../*") { $tgt = "xl/" + ($tgt -replace "^\.\./","") }
                else { $tgt = "xl/" + $tgt }
                $rIdToMedia[$rel.GetAttribute("Id")] = $tgt
            }
        }
        foreach ($pic in $pics) {
            $cnv = $pic.SelectSingleNode(".//xdr:cNvPr",$cins)
            $dispId = if ($cnv) { $cnv.GetAttribute("name") } else { "" }
            $blip = $pic.SelectSingleNode(".//a:blip",$cins)
            $embed = if ($blip) { $blip.GetAttribute("embed",$RNS) } else { "" }
            $mediaP = if ($embed -and $rIdToMedia.ContainsKey($embed)) { $rIdToMedia[$embed] } else { "" }
            if ($dispId -and $mediaP) { $idToMedia[$dispId] = $mediaP }
        }
        W "DISPIMG id->media mappings: $($idToMedia.Count)"
        foreach ($k in ($idToMedia.Keys | Select-Object -First 5)) { W "  $k -> $($idToMedia[$k])" }
    } else {
        W "WARNING: xl/cellimages.xml not found"
    }

    # ---- workbook: sheet name -> sheet file (via @r:id SelectSingleNode) ----
    $wb = New-Object System.Xml.XmlDocument; $wb.Load($zip.GetEntry("xl/workbook.xml").Open())
    $wbns = New-Object System.Xml.XmlNamespaceManager($wb.NameTable)
    $wbns.AddNamespace("m",$MNS); $wbns.AddNamespace("r",$RNS)
    $wbr = New-Object System.Xml.XmlDocument; $wbr.Load($zip.GetEntry("xl/_rels/workbook.xml.rels").Open())
    $wbrns = New-Object System.Xml.XmlNamespaceManager($wbr.NameTable); $wbrns.AddNamespace("rel",$PKG)
    $ridToTarget = @{}
    foreach ($rel in $wbr.SelectNodes("//rel:Relationship",$wbrns)) { $ridToTarget[$rel.GetAttribute("Id")] = $rel.GetAttribute("Target") }

    $sheetList = @()  # ordered: @{Name=; File=}
    foreach ($sh in $wb.SelectNodes("//m:sheet",$wbns)) {
        $nm = $sh.GetAttribute("name")
        $ridNode = $sh.SelectSingleNode("@r:id",$wbns)
        $rid = if ($ridNode) { $ridNode.Value } else { "" }
        $tgt = $ridToTarget[$rid]
        $path = if ($tgt) { ("xl/" + $tgt) } else { "" }
        $sheetList += [PSCustomObject]@{Name=$nm; File=$path}
        W "sheet: '$nm' rid='$rid' -> $path"
    }

    # ---- for each sheet: build cell grid, find DISPIMG rows ----
    # mediaPath -> list of @{Device;Sample;Item;Row;Sheet;DispId}
    $mediaRows = @{}
    foreach ($sh in $sheetList) {
        if (-not $sh.File) { continue }
        $ent = $zip.GetEntry($sh.File)
        if (-not $ent) { W "  no entry for $($sh.File)"; continue }
        $sx = New-Object System.Xml.XmlDocument; $sx.Load($ent.Open())
        $sns = New-Object System.Xml.XmlNamespaceManager($sx.NameTable); $sns.AddNamespace("m",$MNS)
        # cell ref -> text
        $cells = @{}
        foreach ($c in $sx.SelectNodes("//m:c",$sns)) {
            $ref=$c.GetAttribute("r"); $t=$c.GetAttribute("t")
            $v=$c.SelectSingleNode("m:v",$sns); $val = if($v){$v.InnerText}else{""}
            $isFormula = $false
            $fNode = $c.SelectSingleNode("m:f",$sns)
            if ($fNode) { $val = $fNode.InnerText; $isFormula = $true }
            if ($t -eq "s" -and $val -and -not $isFormula) { try { $val=$shared[[int]$val] } catch {} }
            if ($null -ne $val -and $val -ne "") { $cells[$ref] = $val }
        }
        W "$($sh.Name): $($cells.Count) cells"
        # find rows where column J has DISPIMG
        $rowRefs = @{}
        foreach ($k in $cells.Keys) {
            if ($k -match '^J(\d+)$') { $rowRefs[[int]$Matches[1]] = $cells[$k] }
        }
        W "  rows with J (image) formula: $($rowRefs.Count)"
        foreach ($r in ($rowRefs.Keys | Sort-Object)) {
            $jVal = $rowRefs[$r]
            $dispId = ""
            if ($jVal -match 'DISPIMG\("([^"]+)"') { $dispId = $Matches[1] }
            $mediaP = if ($dispId -and $idToMedia.ContainsKey($dispId)) { $idToMedia[$dispId] } else { "" }
            $device = $cells["B$r"]; if (-not $device) { $device = "" }
            $sample = $cells["C$r"]; if (-not $sample) { $sample = "" }
            $item   = $cells["F$r"]; if (-not $item) { $item = "" }
            if (-not $mediaP) { continue }
            if (-not $mediaRows.ContainsKey($mediaP)) { $mediaRows[$mediaP] = @() }
            $mediaRows[$mediaP] += [PSCustomObject]@{Device=$device;Sample=$sample;Item=$item;Row=$r;Sheet=$sh.Name;DispId=$dispId}
        }
    }

    W "`n=== unique media files with context: $($mediaRows.Count) ==="

    # ---- extract each unique media file ----
    function Sanitize([string]$s) {
        $s = $s -replace '[\\/:*?""<>|\s]','_'
        $s = $s -replace '_+','_'
        $s = $s.Trim('_')
        return $s
    }
    $seq = 0
    $manifest = New-Object System.Collections.ArrayList
    # order media by first appearance row
    $ordered = $mediaRows.GetEnumerator() | Sort-Object { $_.Value[0].Sheet, [int]$_.Value[0].Row }
    foreach ($entry in $ordered) {
        $mediaP = $entry.Key
        $infos = $entry.Value
        $first = $infos[0]
        $seq++
        $ent = $zip.GetEntry($mediaP)
        if (-not $ent) { W "  MISSING entry $mediaP"; continue }
        $ext = [System.IO.Path]::GetExtension($mediaP).ToLower()
        $dev = Sanitize $first.Device
        $smp = Sanitize $first.Sample
        if (-not $dev) { $dev = "nodevice" }
        if (-not $smp) { $smp = "nosample" }
        $name = "{0}_{1}_{2:D2}{3}" -f $dev, $smp, $seq, $ext
        # shorten if too long
        if ($name.Length -gt 80) { $name = "{0}_{1}_{2:D2}{3}" -f $dev.Substring(0,[Math]::Min(20,$dev.Length)), $smp.Substring(0,[Math]::Min(20,$smp.Length)), $seq, $ext }
        $outPath = Join-Path $OUT $name
        $n=1
        while (Test-Path $outPath) { $outPath = Join-Path $OUT ($name -replace [regex]::Escape($ext),"_${n}$ext"); $n++ }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($ent, $outPath, $true)
        $finalName = Split-Path $outPath -Leaf
        W "  $finalName  <- $mediaP  (disp=$($first.DispId))"
        # manifest line: all associations
        $assoc = ($infos | ForEach-Object { "$($_.Device)/$($_.Sample)/$($_.Item)" }) -join " ; "
        [void]$manifest.Add("$finalName`t$mediaP`t[$assoc]")
    }

    $mp = Join-Path $OUT "manifest.txt"
    $manifest | Out-File -FilePath $mp -Encoding utf8
    W "`nmanifest: $mp"
    W "total extracted: $seq"
} finally { $zip.Dispose() }

$buf | Out-File -FilePath $LOGF -Encoding utf8
Write-Output "FINAL_DONE extracted=$seq"
