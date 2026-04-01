@echo off
setlocal
cd /d "%~dp0"
echo [Quiz MVP] Repertoire: %CD%

if not exist .env (
  if exist .env.example (
    echo Creation de .env a partir de .env.example ...
    copy /y .env.example .env >nul
    echo Pensez a editer .env (JWT_SECRET, etc.)
  )
)

echo Construction et demarrage des conteneurs...
docker compose up -d --build --remove-orphans
if errorlevel 1 (
  echo Echec. Verifiez Docker Desktop et les ports 80 / 3000.
  exit /b 1
)

echo.
echo Pret : http://localhost   ^| API : http://localhost/api   ^| Sante : http://localhost/health
echo Logs backend : docker compose logs -f backend
echo Arret : docker compose down
exit /b 0
