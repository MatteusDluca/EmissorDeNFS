@echo off
setlocal EnableDelayedExpansion

echo =======================================================
echo          NFS-E EMISSOR - STARTUP AUTOMATIZADO          
echo           (Ambiente Completo 100%% Dockerizado)           
echo =======================================================
echo.

:: 1. Verificar Docker
docker --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERRO] O Docker nao esta instalado ou nao esta no PATH.
    echo Por favor, instale o Docker Desktop antes de continuar.
    pause
    exit /b 1
)

:: 2. Verificar Docker Daemon
:check_docker
docker info >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [AVISO] O Docker esta instalado, mas o servico ^(Daemon^) NAO esta rodando.
    echo Por favor, abra o Docker Desktop agora no seu Windows.
    echo Aguarde ele iniciar completamente e pressione ENTER...
    pause >nul
    goto check_docker
)
echo [OK] Docker esta instalado e rodando perfeitamente.

:: 3. Configurar .env Seguro
IF NOT EXIST .env (
    echo [OK] Arquivo .env nao encontrado. Gerando um novo de forma sigilosa...
    copy .env.example .env >nul
    
    :: Substituicao com powershell ofuscando o codigo e gerando chaves unicas
    powershell -Command "(Get-Content .env) -replace 'your-super-secret-jwt-key-change-in-production', ([guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()) | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace 'your-aes-256-key-must-be-32-chars!!', ([guid]::NewGuid().ToString('N')) | Set-Content .env"
    
    echo [OK] Chaves de seguranca geradas com protecao local.
) else (
    echo [OK] Arquivo .env ja identificado.
)

:: 4. Subir containers via Docker Compose
echo.
echo [!] Iniciando a construcao e subida dos containers. Isso pode demorar na primeira vez...
call docker-compose up --build -d

echo.
echo =======================================================
echo    TUDO PRONTO E RODANDO ISOLADO NO SEU DOCKER!     
echo =======================================================
echo - API: http://localhost:3000
echo - Postgres: localhost:5432
echo - Redis: localhost:6379 
echo - A API ja vai rodar as migracoes e criar os seeds!
echo =======================================================
pause
