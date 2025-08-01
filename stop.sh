#!/bin/bash

# Knowledge Management System - Stop Script
# This script safely stops all services and cleans up processes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to safely kill a process
safe_kill() {
    local pid=$1
    local service_name=$2
    
    if kill -0 "$pid" 2>/dev/null; then
        print_status "Stopping $service_name (PID: $pid)..."
        
        # Try graceful shutdown first
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait up to 10 seconds for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            ((count++))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Force killing $service_name..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        print_success "$service_name stopped"
    else
        print_status "$service_name was not running"
    fi
}

# Function to stop application services
stop_app_services() {
    print_status "Stopping application services..."
    
    # Stop services using PID files
    if [ -f ".pids/frontend.pid" ]; then
        local pid=$(cat .pids/frontend.pid)
        safe_kill "$pid" "Frontend"
        rm -f .pids/frontend.pid
    fi
    
    if [ -f ".pids/backend.pid" ]; then
        local pid=$(cat .pids/backend.pid)
        safe_kill "$pid" "Backend"
        rm -f .pids/backend.pid
    fi
    
    if [ -f ".pids/ai.pid" ]; then
        local pid=$(cat .pids/ai.pid)
        safe_kill "$pid" "AI Service"
        rm -f .pids/ai.pid
    fi
    
    # Clean up any remaining Node.js processes that might be related
    print_status "Cleaning up any remaining processes..."
    
    # Find and kill processes using the specific ports
    if command_exists lsof; then
        # Kill processes on port 3000 (frontend)
        local frontend_pids=$(lsof -ti:3000 2>/dev/null || true)
        if [ -n "$frontend_pids" ]; then
            print_status "Cleaning up remaining frontend processes..."
            echo "$frontend_pids" | xargs -r kill -TERM 2>/dev/null || true
            sleep 2
            echo "$frontend_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
        
        # Kill processes on port 8000 (backend)
        local backend_pids=$(lsof -ti:8000 2>/dev/null || true)
        if [ -n "$backend_pids" ]; then
            print_status "Cleaning up remaining backend processes..."
            echo "$backend_pids" | xargs -r kill -TERM 2>/dev/null || true
            sleep 2
            echo "$backend_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
        
        # Kill processes on port 8001 (AI service)
        local ai_pids=$(lsof -ti:8001 2>/dev/null || true)
        if [ -n "$ai_pids" ]; then
            print_status "Cleaning up remaining AI service processes..."
            echo "$ai_pids" | xargs -r kill -TERM 2>/dev/null || true
            sleep 2
            echo "$ai_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
    elif command_exists netstat; then
        # Alternative approach using netstat and ps
        print_status "Using netstat to find and clean up processes..."
        
        # Find PIDs using ports and kill them
        for port in 3000 8000 8001; do
            local pids=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$' || true)
            if [ -n "$pids" ]; then
                print_status "Cleaning up processes on port $port..."
                echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
                sleep 2
                echo "$pids" | xargs -r kill -KILL 2>/dev/null || true
            fi
        done
    fi
    
    # Alternative: Kill by process name pattern (more aggressive)
    if command_exists pkill; then
        print_status "Cleaning up by process pattern..."
        # Kill any node processes that might be related to our services
        pkill -f "npm run dev" 2>/dev/null || true
        pkill -f "vite.*--port 3000" 2>/dev/null || true
        pkill -f "uvicorn.*main:app" 2>/dev/null || true
        sleep 2
    fi
    
    # Clean up PID directory
    rm -rf .pids
}

# Function to stop Docker services
stop_docker_services() {
    print_status "Stopping Docker services..."
    
    if ! command_exists docker; then
        print_warning "Docker is not installed or not in PATH, skipping Docker cleanup"
        return 0
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_warning "Docker is not running, skipping Docker cleanup"
        return 0
    fi
    
    # Stop all services defined in docker-compose
    if [ -f "docker-compose.dev.yml" ]; then
        print_status "Stopping Docker Compose services..."
        docker-compose -f docker-compose.dev.yml down
        
        # Optional: Remove volumes (uncomment if you want to clean data)
        # print_warning "Removing Docker volumes (this will delete all data)..."
        # docker-compose -f docker-compose.dev.yml down -v
    fi
    
    # Clean up any dangling containers related to the project
    print_status "Cleaning up project containers..."
    
    # Remove any containers with km- prefix (our naming convention)
    local km_containers=$(docker ps -aq --filter "name=km-" 2>/dev/null || true)
    if [ -n "$km_containers" ]; then
        print_status "Removing knowledge management containers..."
        echo "$km_containers" | xargs -r docker rm -f 2>/dev/null || true
    fi
    
    # Clean up any dangling images (optional)
    # Uncomment the following lines if you want to clean up unused Docker images
    # print_status "Cleaning up dangling Docker images..."
    # docker image prune -f
}

# Function to clean up temporary files
cleanup_temp_files() {
    print_status "Cleaning up temporary files..."
    
    # Remove log files if they exist
    if [ -d "logs" ]; then
        rm -rf logs/*.log 2>/dev/null || true
    fi
    
    # Remove any temporary files
    rm -f nohup.out 2>/dev/null || true
    
    # Clean up any .env.local files that might have been created
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    find . -name "*.temp" -type f -delete 2>/dev/null || true
}

# Function to show final status
show_final_status() {
    print_success "🛑 Knowledge Management System has been stopped"
    echo ""
    print_status "All services have been safely terminated"
    print_status "Docker containers have been stopped and removed"
    print_status "Temporary files have been cleaned up"
    echo ""
    print_status "Use './start.sh' to start the system again"
    echo ""
}

# Function to force kill everything (nuclear option)
force_cleanup() {
    print_warning "🚨 FORCE CLEANUP MODE - This will aggressively kill all related processes"
    read -p "Are you sure? This might affect other Node.js/Python applications. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Force cleanup cancelled"
        return 0
    fi
    
    print_status "Performing aggressive cleanup..."
    
    # Kill all node processes running on our ports
    if command_exists pkill; then
        pkill -f "node.*3000" 2>/dev/null || true
        pkill -f "node.*8000" 2>/dev/null || true
        pkill -f "uvicorn" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
    fi
    
    # Force remove all km- containers
    if command_exists docker; then
        docker ps -aq --filter "name=km-" | xargs -r docker rm -f 2>/dev/null || true
        docker ps -aq --filter "ancestor=*knowledge*" | xargs -r docker rm -f 2>/dev/null || true
    fi
    
    print_warning "Force cleanup completed"
}

# Main execution
main() {
    print_status "Stopping Knowledge Management System..."
    
    # Stop application services
    stop_app_services
    
    # Stop Docker services
    stop_docker_services
    
    # Clean up temporary files
    cleanup_temp_files
    
    # Show final status
    show_final_status
}

# Handle script arguments
case "${1:-}" in
    "docker-only")
        print_status "Stopping Docker services only..."
        stop_docker_services
        print_success "Docker services stopped!"
        ;;
    "app-only")
        print_status "Stopping application services only..."
        stop_app_services
        cleanup_temp_files
        print_success "Application services stopped!"
        ;;
    "force")
        force_cleanup
        main
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [docker-only|app-only|force]"
        echo ""
        echo "Options:"
        echo "  docker-only  Stop only Docker infrastructure services"
        echo "  app-only     Stop only application services"
        echo "  force        Aggressively kill all related processes (use with caution)"
        echo "  (no args)    Stop everything safely"
        ;;
    *)
        main
        ;;
esac
