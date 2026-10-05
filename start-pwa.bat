@echo off
chcp 65001 > nul
title MedStock Pro - Кабинет владельца (iOS PWA)
cd /d %~dp0pwa
echo Запуск мобильного PWA-сервера на порту 5000...
start http://localhost:5000
npm start
