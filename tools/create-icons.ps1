Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../assets'
function Write-Icon([string]$Name, [int]$Size, [bool]$Transparent) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  if ($Transparent) { $graphics.Clear([System.Drawing.Color]::Transparent) }
  else { $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#147D69')) }
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, ($Size * 0.065))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.32, $Size * 0.51),
    [System.Drawing.PointF]::new($Size * 0.46, $Size * 0.65),
    [System.Drawing.PointF]::new($Size * 0.70, $Size * 0.36)
  )
  $graphics.DrawLines($pen, $points)
  $bitmap.Save((Join-Path $assetDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
Write-Icon 'icon.png' 1024 $false
Write-Icon 'android-icon-foreground.png' 1024 $true
Write-Icon 'android-icon-monochrome.png' 1024 $true
Write-Icon 'favicon.png' 64 $false
