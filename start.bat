@echo off
setlocal enabledelayedexpansion

:: Knowledge Management System - Start Script (Windows)
:: This script starts all services required for the knowledge management system

title Knowledge Management System - Startup

echo [INFO] Starting Knowledge Management System...

:: Create necessary directories
if not exist "logs" mkdir logs
if not exist ".pids" mkdir .pids

:: Function to check if a port is in use
:check_port
netstat -an | find ":%1 " >nul 2>&1
exit /b %errorlevel%

:: Function to wait for service
:wait_for_service
set "port=%1"
set "service_name=%2"
set "attempts=0"
set "max_attempts=30"

echo [INFO] Waiting for %service_name% to be ready...

:wait_loop
call :check_port %port%
if %errorlevel% equ 0 (
    echo [SUCCESS] %service_name% is ready!
    exit /b 0
)

set /a attempts+=1
if %attempts% geq %max_attempts% (
    echo [ERROR] %service_name% failed to start within timeout
    exit /b 1
)

echo|set /p="."
timeout /t 2 /nobreak >nul
goto wait_loop

:: Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    pause
    exit /b 1
)

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

:: Start Docker infrastructure services
echo [INFO] Starting Docker infrastructure services...
docker-compose -f docker-compose.dev.yml up -d postgres neo4j weaviate elasticsearch minio redis

:: Wait for critical services
call :wait_for_service 5432 "PostgreSQL"
call :wait_for_service 7474 "Neo4j"
call :wait_for_service 8080 "Weaviate"
call :wait_for_service 9200 "Elasticsearch"
call :wait_for_service 9000 "MinIO"
call :wait_for_service 6379 "Redis"

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    python3 --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not installed
        pause
        exit /b 1
    )
    set "python_cmd=python3"
) else (
    set "python_cmd=python"
)

:: Install dependencies if needed
echo [INFO] Checking and installing dependencies...

if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    npm install
)

if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

if not exist "ai\.deps_installed" (
    echo [INFO] Installing AI service dependencies...
    cd ai
    %python_cmd% -m pip install -r requirements.txt
    echo. > .deps_installed
    cd ..
)

:: Start application services
echo [INFO] Starting application services...

:: Start backend service
echo [INFO] Starting backend service...
cd backend
start "Backend Service" /min cmd /c "npm run dev > ..\logs\backend.log 2>&1"
cd ..

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start AI service
echo [INFO] Starting AI service...
cd ai
start "AI Service" /min cmd /c "%python_cmd% -m uvicorn main:app --reload --host 0.0.0.0 --port 8001 > ..\logs\ai.log 2>&1"
cd ..

:: Wait a moment for AI service to start
timeout /t 3 /nobreak >nul

:: Start frontend service
echo [INFO] Starting frontend service...
cd frontend
start "Frontend Service" /min cmd /c "npm run dev > ..\logs\frontend.log 2>&1"
cd ..

:: Wait for services to be ready
call :wait_for_service 8000 "Backend API"
call :wait_for_service 8001 "AI Service"
call :wait_for_service 3000 "Frontend"

:: Show status
echo.
echo [SUCCESS] 🚀 Knowledge Management System is now running!
echo.
echo 📊 Service URLs:
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:8000
echo   AI Service:   http://localhost:8001
echo.
echo 🗄️ Database Services:
echo   PostgreSQL:   localhost:5432
echo   Neo4j:        http://localhost:7474
echo   Weaviate:     http://localhost:8080
echo   Elasticsearch: http://localhost:9200
echo   MinIO:        http://localhost:9001
echo   Redis:        localhost:6379
echo.
echo 📝 Logs are available in the logs\ directory
echo 🛑 Use 'stop.bat' to stop all services
echo.

pause
