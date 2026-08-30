$adb = "C:\platform-tools\platform-tools\adb.exe"

Write-Host "Forwarding ports..."
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:8088 tcp:8088
Write-Host "Ports forwarded. Launching app..."

& $adb shell am start -a android.intent.action.VIEW -d "them://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.avicoiot.them

Write-Host "Done."
