@echo off
cd /d %~dp0

echo Запуск MedStock Pro...

start "MedStock-Backend" cmd /k "cd /d %~dp0server && npm start"
timeout /t 2 /nobreak > nul

start "MedStock-PWA" cmd /k "cd /d %~dp0pwa && npm start"
timeout /t 2 /nobreak > nul

cd /d %~dp0desktop
npm start
