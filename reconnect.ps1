$adb = "C:\platform-tools\platform-tools\adb.exe"
& $adb reverse tcp:8081 tcp:8081
& $adb shell am start -a android.intent.action.VIEW -d "exp+avi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.avicoiot.them
Write-Host "Done — app should open on your phone now."
