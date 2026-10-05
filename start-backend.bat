@echo off
chcp 65001 > nul
title MedStock Pro - Облачный бэкенд API
cd /d %~dp0server
echo Запуск облачного бэкенда и шлюза синхронизации на порту 4000...
npm start
