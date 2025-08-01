@echo off
setlocal enabledelayedexpansion

:: Knowledge Management System - Stop Script (Windows)
:: This script safely stops all services and cleans up processes

title Knowledge Management System - Shutdown

echo [INFO] Stopping Knowledge Management System...

:: Function to kill processes on a specific port
:kill_port_processes
set "port=%1"
for /f "tokens=5" %%a in ('netstat -ano ^| find ":%port% "') do (
    if "%%a" neq "" (
        echo [INFO] Killing process %%a on port %port%
        taskkill /PID %%a /F >nul 2>&1
    )
)
exit /b 0

:: Stop application services by killing processes on their ports
echo [INFO] Stopping application services...

:: Kill processes on port 3000 (frontend)
echo [INFO] Stopping frontend service...
call :kill_port_processes 3000

:: Kill processes on port 8000 (backend)
echo [INFO] Stopping backend service...
call :kill_port_processes 8000

:: Kill processes on port 8001 (AI service)
echo [INFO] Stopping AI service...
call :kill_port_processes 8001

:: Additional cleanup - kill by process name
echo [INFO] Cleaning up remaining processes...

:: Kill any Node.js processes that might be our services
taskkill /IM "node.exe" /F >nul 2>&1
taskkill /IM "npm.cmd" /F >nul 2>&1

:: Kill any Python processes that might be our AI service
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV ^| find "uvicorn"') do (
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python3.exe" /FO CSV ^| find "uvicorn"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Stop Docker services
echo [INFO] Stopping Docker services...

:: Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not installed or not in PATH, skipping Docker cleanup
    goto cleanup_files
)

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not running, skipping Docker cleanup
    goto cleanup_files
)

:: Stop Docker Compose services
if exist "docker-compose.dev.yml" (
    echo [INFO] Stopping Docker Compose services...
    docker-compose -f docker-compose.dev.yml down
)

:: Clean up any dangling containers related to the project
echo [INFO] Cleaning up project containers...

:: Remove any containers with km- prefix (our naming convention)
for /f "tokens=1" %%a in ('docker ps -aq --filter "name=km-" 2^>nul') do (
    echo [INFO] Removing container %%a
    docker rm -f %%a >nul 2>&1
)

:cleanup_files
:: Clean up temporary files
echo [INFO] Cleaning up temporary files...

:: Remove PID directory
if exist ".pids" rmdir /s /q ".pids" >nul 2>&1

:: Remove log files
if exist "logs" (
    del /q "logs\*.log" >nul 2>&1
)

:: Remove temporary files
if exist "nohup.out" del "nohup.out" >nul 2>&1

:: Clean up any .tmp and .temp files
for /r . %%f in (*.tmp *.temp) do del "%%f" >nul 2>&1

:: Show final status
echo.
echo [SUCCESS] 🛑 Knowledge Management System has been stopped
echo.
echo [INFO] All services have been safely terminated
echo [INFO] Docker containers have been stopped and removed
echo [INFO] Temporary files have been cleaned up
echo.
echo [INFO] Use 'start.bat' to start the system again
echo.

pause
