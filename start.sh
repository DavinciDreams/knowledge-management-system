#!/bin/bash

# Knowledge Management System - Start Script
# This script starts all services required for the knowledge management system

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

# Function to check if a port is in use
port_in_use() {
    if command_exists netstat; then
        netstat -an | grep ":$1 " >/dev/null 2>&1
    elif command_exists ss; then
        ss -an | grep ":$1 " >/dev/null 2>&1
    else
        # Fallback: try to connect to the port
        timeout 1 bash -c "</dev/tcp/localhost/$1" >/dev/null 2>&1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if port_in_use $port; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "$service_name failed to start within timeout"
            return 1
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
}

# Function to start Docker services
start_docker_services() {
    print_status "Starting Docker infrastructure services..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Start infrastructure services only (not the app services)
    docker-compose -f docker-compose.dev.yml up -d postgres neo4j weaviate elasticsearch minio redis
    
    # Wait for critical services
    wait_for_service localhost 5432 "PostgreSQL"
    wait_for_service localhost 7474 "Neo4j"
    wait_for_service localhost 8080 "Weaviate"
    wait_for_service localhost 9200 "Elasticsearch"
    wait_for_service localhost 9000 "MinIO"
    wait_for_service localhost 6379 "Redis"
}

# Function to install dependencies
install_dependencies() {
    print_status "Checking and installing dependencies..."
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check Python
    if ! command_exists python && ! command_exists python3; then
        print_error "Python is not installed"
        exit 1
    fi
    
    # Install root dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing root dependencies..."
        npm install
    fi
    
    # Install frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    # Install backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        print_status "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi
    
    # Install AI service dependencies
    if [ ! -d "ai/venv" ] && [ ! -f "ai/.deps_installed" ]; then
        print_status "Installing AI service dependencies..."
        cd ai
        if command_exists python3; then
            python3 -m pip install -r requirements.txt
        else
            python -m pip install -r requirements.txt
        fi
        touch .deps_installed
        cd ..
    fi
}

# Function to start application services
start_app_services() {
    print_status "Starting application services..."
    
    # Create PID directory if it doesn't exist
    mkdir -p .pids
    
    # Start backend service
    print_status "Starting backend service..."
    cd backend
    nohup npm run dev > ../logs/backend.log 2>&1 &
    echo $! > ../.pids/backend.pid
    cd ..
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start AI service
    print_status "Starting AI service..."
    cd ai
    if command_exists python3; then
        nohup python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8001 > ../logs/ai.log 2>&1 &
    else
        nohup python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001 > ../logs/ai.log 2>&1 &
    fi
    echo $! > ../.pids/ai.pid
    cd ..
    
    # Wait a moment for AI service to start
    sleep 3
    
    # Start frontend service
    print_status "Starting frontend service..."
    cd frontend
    nohup npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > ../.pids/frontend.pid
    cd ..
    
    # Wait for services to be ready
    wait_for_service localhost 8000 "Backend API"
    wait_for_service localhost 8001 "AI Service"
    wait_for_service localhost 3000 "Frontend"
}

# Function to show status
show_status() {
    print_success "🚀 Knowledge Management System is now running!"
    echo ""
    echo "📊 Service URLs:"
    echo "  Frontend:     http://localhost:3000"
    echo "  Backend API:  http://localhost:8000"
    echo "  AI Service:   http://localhost:8001"
    echo ""
    echo "🗄️ Database Services:"
    echo "  PostgreSQL:   localhost:5432"
    echo "  Neo4j:        http://localhost:7474"
    echo "  Weaviate:     http://localhost:8080"
    echo "  Elasticsearch: http://localhost:9200"
    echo "  MinIO:        http://localhost:9001"
    echo "  Redis:        localhost:6379"
    echo ""
    echo "📝 Logs are available in the logs/ directory"
    echo "🛑 Use './stop.sh' to stop all services"
    echo ""
}

# Main execution
main() {
    print_status "Starting Knowledge Management System..."
    
    # Create logs directory
    mkdir -p logs
    
    # Check if services are already running
    if port_in_use 3000 || port_in_use 8000 || port_in_use 8001; then
        print_warning "Some services appear to be already running. Use './stop.sh' first if you want to restart."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Start Docker services
    start_docker_services
    
    # Install dependencies
    install_dependencies
    
    # Start application services
    start_app_services
    
    # Show status
    show_status
}

# Handle script arguments
case "${1:-}" in
    "docker-only")
        print_status "Starting Docker services only..."
        start_docker_services
        print_success "Docker services started!"
        ;;
    "app-only")
        print_status "Starting application services only..."
        mkdir -p logs
        install_dependencies
        start_app_services
        show_status
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [docker-only|app-only]"
        echo ""
        echo "Options:"
        echo "  docker-only  Start only Docker infrastructure services"
        echo "  app-only     Start only application services (assumes Docker is running)"
        echo "  (no args)    Start everything"
        ;;
    *)
        main
        ;;
esac
