@echo off
setlocal
cd /d "%~dp0"
echo [Quiz MVP] Repertoire: %CD%

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] La commande "docker" est introuvable. Installez Docker Desktop pour Windows.
  pause
  exit /b 1
)

echo Verification du moteur Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERREUR] Docker ne repond pas ^(connexion impossible au daemon^).
  echo.
  echo Si vous voyez "ENOENT" ou "dockerBackendApiServer" :
  echo   1. Ouvrez Docker Desktop depuis le menu Demarrer.
  echo   2. Attendez "Engine running" ^(icone verte dans la barre des taches^).
  echo   3. Relancez ce script : start-docker.cmd
  echo.
  echo Si ca persiste : fermez Docker Desktop completement, rouvrez-le, ou redemarrez le PC.
  echo.
  pause
  exit /b 1
)

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
