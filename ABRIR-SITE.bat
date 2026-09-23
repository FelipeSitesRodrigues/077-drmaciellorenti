@echo off
rem Abre o site da Clinica Lorenti no navegador (servidor local na porta 3077).
cd /d "%~dp0"
start "" http://localhost:3077
node scripts\serve.mjs 3077
