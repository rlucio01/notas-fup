Add-Type -AssemblyName System.Drawing
Get-ChildItem -Path "src-tauri/icons/*.png" | ForEach-Object {
    $orig = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $bmp = New-Object System.Drawing.Bitmap($orig.Width, $orig.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($orig, 0, 0, $orig.Width, $orig.Height)
    $g.Dispose()
    $orig.Dispose()
    $tmpPath = $_.FullName + ".tmp"
    $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Move-Item -Force $tmpPath $_.FullName
    Write-Host "Converted: $($_.Name)"
}
