@echo off
chcp 65001 > nul
cd /d %~dp0

echo ========================================================
echo  MedStock Pro - Запуск всех сервисов экосистемы
echo ========================================================

echo Проверка и освобождение портов...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :4000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo [1/3] Запуск Cloud API & Синхронизация (порт 4000)...
start "MedStock-Backend" cmd /k "cd /d %~dp0server && npm start"
timeout /t 2 /nobreak > nul

echo [2/3] Запуск Мобильного PWA кабинета (порт 5000)...
start "MedStock-PWA" cmd /k "cd /d %~dp0pwa && npm start"
timeout /t 2 /nobreak > nul

echo [3/3] Запуск Windows Desktop приложения (порт 3000)...
cd /d %~dp0desktop
npm start

