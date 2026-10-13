Get-Process node, electron -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = $_
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
    Write-Host "$($proc.Id) ($($proc.ProcessName)): $cmd"
}
