param(
    [string]$ImagePath,
    [string]$SearchText,
    [int]$MinSimilarity = 80,
    [int]$X1 = 0,
    [int]$Y1 = 0,
    [int]$X2 = 0,
    [int]$Y2 = 0
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Length -eq 1 }

function AwaitTask($asyncOp, $type) {
    $m = $asTask[0].MakeGenericMethod($type)
    $t = $m.Invoke($null, @($asyncOp))
    return $t.GetAwaiter().GetResult()
}

function CalcSim([string]$s1, [string]$s2) {
    if ([string]::IsNullOrEmpty($s1) -or [string]::IsNullOrEmpty($s2)) { return 0 }
    if ($s1 -eq $s2) { return 100 }
    if ($s1.Contains($s2) -or $s2.Contains($s1)) { return 100 }
    
    $len1 = $s1.Length; $len2 = $s2.Length
    if ($len1 -lt 2 -or $len2 -lt 2) { return 0 }
    $b1 = New-Object System.Collections.Generic.HashSet[string]
    for ($i = 0; $i -lt $len1 - 1; $i++) { [void]$b1.Add($s1.Substring($i, 2)) }
    $hits = 0
    for ($j = 0; $j -lt $len2 - 1; $j++) {
        $sub = $s2.Substring($j, 2)
        if ($b1.Contains($sub)) { $hits++ }
    }
    return [Math]::Round(($hits * 2.0) / ($len1 + $len2 - 2) * 100)
}

try {
    $cropFile = $null
    $targetPath = $ImagePath
    $offsetX = 0
    $offsetY = 0

    if ($X2 -gt $X1 -and $Y2 -gt $Y1) {
        $srcBmp = [System.Drawing.Image]::FromFile($ImagePath)
        $w = [Math]::Min($srcBmp.Width - $X1, $X2 - $X1)
        $h = [Math]::Min($srcBmp.Height - $Y1, $Y2 - $Y1)
        if ($w -gt 10 -and $h -gt 10) {
            $rect = New-Object System.Drawing.Rectangle $X1, $Y1, $w, $h
            $cropped = $srcBmp.Clone($rect, $srcBmp.PixelFormat)
            $cropFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "mory-crop-$([System.Guid]::NewGuid().ToString()).png")
            $cropped.Save($cropFile, [System.Drawing.Imaging.ImageFormat]::Png)
            $cropped.Dispose()
            $targetPath = $cropFile
            $offsetX = $X1
            $offsetY = $Y1
        }
        $srcBmp.Dispose()
    }

    $file = AwaitTask ([Windows.Storage.StorageFile]::GetFileFromPathAsync($targetPath)) ([Windows.Storage.StorageFile])
    $stream = AwaitTask ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = AwaitTask ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sbm = AwaitTask ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage("zh-Hans-CN")
    }
    $ocr = AwaitTask ($engine.RecognizeAsync($sbm)) ([Windows.Media.Ocr.OcrResult])

    if ($cropFile -and (Test-Path $cropFile)) {
        Remove-Item $cropFile -ErrorAction SilentlyContinue
    }

    $cleanQuery = $SearchText.Replace(" ", "").ToLower()
    $bestSim = 0

    foreach ($line in $ocr.Lines) {
        $rawLine = $line.Text
        $cleanLine = $rawLine.Replace(" ", "").ToLower()

        $sim = CalcSim $cleanLine $cleanQuery
        if ($sim -gt $bestSim) {
            $bestSim = $sim
        }

        if ($cleanLine.Contains($cleanQuery) -or $sim -ge $MinSimilarity) {
            $words = $line.Words
            $minX = 999999; $minY = 999999; $maxX = 0; $maxY = 0

            foreach ($w in $words) {
                $cw = $w.Text.Replace(" ", "").ToLower()
                if ($cleanQuery.Contains($cw) -or $cw.Contains($cleanQuery) -or (CalcSim $cw $cleanQuery) -gt 50) {
                    $r = $w.BoundingRect
                    if ($r.X -lt $minX) { $minX = $r.X }
                    if ($r.Y -lt $minY) { $minY = $r.Y }
                    if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
                    if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
                }
            }

            if ($minX -ge 999999) {
                foreach ($w in $words) {
                    $r = $w.BoundingRect
                    if ($r.X -lt $minX) { $minX = $r.X }
                    if ($r.Y -lt $minY) { $minY = $r.Y }
                    if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
                    if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
                }
            }

            $w = [Math]::Round($maxX - $minX)
            $h = [Math]::Round($maxY - $minY)
            $finalX = [Math]::Round($offsetX + $minX)
            $finalY = [Math]::Round($offsetY + $minY)
            $finalCx = [Math]::Round($finalX + $w / 2)
            $finalCy = [Math]::Round($finalY + $h / 2)

            $resObj = @{
                success = $true
                found = $true
                similarity = [Math]::Max(100, $sim)
                text = $rawLine
                x = $finalX
                y = $finalY
                width = $w
                height = $h
                centerX = $finalCx
                centerY = $finalCy
            }
            Write-Output ($resObj | ConvertTo-Json -Compress)
            exit 0
        }
    }

    $failObj = @{
        success = $true
        found = $false
        similarity = $bestSim
        text = ""
        error = "未在指定区域找到文字 '$SearchText' (最高相似度: $bestSim%)"
    }
    Write-Output ($failObj | ConvertTo-Json -Compress)
}
catch {
    $errObj = @{
        success = $false
        found = $false
        error = $_.Exception.Message
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
}
