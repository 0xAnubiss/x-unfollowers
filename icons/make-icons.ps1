Add-Type -AssemblyName System.Drawing

function New-RoundedRect([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Save-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $bg = [System.Drawing.Color]::FromArgb(255, 15, 20, 25)
  $fg = [System.Drawing.Color]::FromArgb(255, 231, 233, 234)
  $blue = [System.Drawing.Color]::FromArgb(255, 29, 155, 240)

  $pad = [int][Math]::Max(1, $size * 0.06)
  $radius = [int][Math]::Max(3, $size * 0.22)
  $rectPath = New-RoundedRect $pad $pad ($size - 2 * $pad) ($size - 2 * $pad) $radius
  $bgBrush = New-Object System.Drawing.SolidBrush $bg
  $g.FillPath($bgBrush, $rectPath)

  $cx = $size / 2
  $headR = $size * 0.13
  $headY = $size * 0.38
  $fgBrush = New-Object System.Drawing.SolidBrush $fg
  $g.FillEllipse($fgBrush, [float]($cx - $headR), [float]($headY - $headR), [float](2 * $headR), [float](2 * $headR))

  $bodyW = $size * 0.42
  $bodyH = $size * 0.28
  $bodyY = $size * 0.54
  $bodyPath = New-RoundedRect ([int]($cx - $bodyW / 2)) ([int]$bodyY) ([int]$bodyW) ([int]$bodyH) ([int]($size * 0.12))
  $g.FillPath($fgBrush, $bodyPath)

  $badgeR = $size * 0.16
  $bx = $size * 0.66
  $by = $size * 0.66
  $blueBrush = New-Object System.Drawing.SolidBrush $blue
  $g.FillEllipse($blueBrush, [float]($bx - $badgeR), [float]($by - $badgeR), [float](2 * $badgeR), [float](2 * $badgeR))

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([float][Math]::Max(1.5, $size * 0.07))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, [float]($bx - $badgeR * 0.45), [float]$by, [float]($bx + $badgeR * 0.45), [float]$by)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $bgBrush.Dispose()
  $fgBrush.Dispose()
  $blueBrush.Dispose()
  $pen.Dispose()
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Save-Icon 16 (Join-Path $dir 'icon16.png')
Save-Icon 48 (Join-Path $dir 'icon48.png')
Save-Icon 128 (Join-Path $dir 'icon128.png')
Write-Output 'icons ok'
