@echo off
:: Creates a desktop shortcut for Mission Control
:: Run this once after cloning

set SHORTCUT_NAME=Mission Control
set TARGET=%~dp0start.bat
set ICON=%~dp0client\public\favicon.svg
set DESKTOP=%USERPROFILE%\Desktop

:: Create VBS script to make shortcut (Windows doesn't have a native shortcut creator)
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\createshortcut.vbs"
echo sLinkFile = "%DESKTOP%\%SHORTCUT_NAME%.lnk" >> "%TEMP%\createshortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\createshortcut.vbs"
echo oLink.TargetPath = "%TARGET%" >> "%TEMP%\createshortcut.vbs"
echo oLink.WorkingDirectory = "%~dp0" >> "%TEMP%\createshortcut.vbs"
echo oLink.Description = "Launch Mission Control Dashboard" >> "%TEMP%\createshortcut.vbs"
echo oLink.Save >> "%TEMP%\createshortcut.vbs"
cscript /nologo "%TEMP%\createshortcut.vbs"
del "%TEMP%\createshortcut.vbs"

echo.
echo  Desktop shortcut created: "%DESKTOP%\%SHORTCUT_NAME%.lnk"
echo  Double-click it to launch Mission Control!
echo.
pause
