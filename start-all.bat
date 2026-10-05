@echo off
chcp 65001 > nul
title MedStock Pro - Запуск экосистемы

echo ================================================================
echo    MedStock Pro — Система учёта медицинского склада и списаний
echo ================================================================
echo.
echo [1/3] Запуск Облачного бэкенда API (Порт 4000)...
start "MedStock Pro - Cloud Backend API (:4000)" cmd /k "cd /d %~dp0server && npm start"

timeout /t 2 /nobreak > nul

echo [2/3] Запуск мобильного веб-сервера PWA владельца (Порт 5000)...
start "MedStock Pro - Кабинет владельца (:5000)" cmd /k "cd /d %~dp0pwa && npm start"

timeout /t 2 /nobreak > nul

echo [3/3] Запуск автономного Windows App приложения склада...
cd /d %~dp0desktop
npm start
