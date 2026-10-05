@echo off
chcp 65001 > nul
title MedStock Pro - Терминал склада (Windows App)
cd /d %~dp0desktop
echo Запуск автономного Windows-приложения склада с локальной SQLite БД...
npm start
