for ($i = 0; $i -le 26; $i++) {
    $folder = "E:\TAMIL SCRIPT VERSION 2\TAMIL SCRIPT DATASET\Modern characters\$i"
    $files = Get-ChildItem $folder -File
    Write-Output "$i -> $($files.Name -join ', ')"
}
