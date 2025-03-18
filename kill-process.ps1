# Prompt the user for the address and port
$addrPort = Read-Host "Enter the address and port (e.g., 127.30.0.0:443)"

# Extract the address and port
$parts = $addrPort -split ":", 2
$address = $parts[0]
$port = $parts[1]

# Find the process using the exact address and port
$processInfo = netstat -ano | Select-String "$address`:$port" | ForEach-Object {
    ($_ -split "\s+")[-1]  # Extract the PID from the last column
}

if (-not $processInfo) {
    Write-Host "No process is listening on $addrPort."
    exit
}

# Convert to an array in case multiple processes are found
$processIds = $processInfo -split "`r?`n"

# Display and terminate each process
foreach ($processId in $processIds) {
    Write-Host "Terminating process with PID: $processId"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

# Verify if the process was successfully terminated
$stillRunning = netstat -ano | Select-String "$address`:$port"
if ($stillRunning) {
    Write-Host "Failed to terminate the process. Make sure you have admin rights."
} else {
    Write-Host "The port $addrPort is now free."
}
