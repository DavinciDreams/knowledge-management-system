# Knowledge Management System - Startup and Shutdown Scripts

This directory contains comprehensive scripts to start and stop all components of the Knowledge Management System safely and efficiently.

## Quick Start

### For Linux/macOS/WSL:
```bash
# Start everything
./start.sh

# Stop everything
./stop.sh
```

### For Windows:
```cmd
# Start everything
start.bat

# Stop everything
stop.bat
```

### Using npm scripts:
```bash
# Start everything (works on all platforms)
npm start

# Stop everything (works on all platforms)
npm stop

# Windows-specific scripts
npm run start:windows
npm run stop:windows
```

## What Gets Started

The start script will:

1. **Docker Infrastructure Services:**
   - PostgreSQL (port 5432) - Main database
   - Neo4j (ports 7474, 7687) - Graph database
   - Weaviate (port 8080) - Vector database
   - Elasticsearch (port 9200) - Search engine
   - MinIO (ports 9000, 9001) - Object storage
   - Redis (port 6379) - Cache and session store

2. **Application Services:**
   - Backend API (port 8000) - Node.js/Express server
   - AI Service (port 8001) - Python/FastAPI microservice
   - Frontend (port 3000) - React/Vite development server

## Advanced Usage

### Partial Startup

Start only Docker services (useful for development):
```bash
./start.sh docker-only
npm run start:docker
```

Start only application services (assumes Docker is already running):
```bash
./start.sh app-only
npm run start:app
```

### Partial Shutdown

Stop only Docker services:
```bash
./stop.sh docker-only
npm run stop:docker
```

Stop only application services:
```bash
./stop.sh app-only
npm run stop:app
```

### Force Cleanup

If services are stuck or not responding properly:
```bash
./stop.sh force
```
⚠️ **Warning:** This will aggressively kill all related processes and should be used with caution.

## Service URLs

Once started, you can access:

- **Frontend Application:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **AI Service:** http://localhost:8001
- **Neo4j Browser:** http://localhost:7474
- **MinIO Console:** http://localhost:9001
- **Elasticsearch:** http://localhost:9200
- **Weaviate:** http://localhost:8080

## Prerequisites

### Required Software:
- **Docker Desktop** - For infrastructure services
- **Node.js** (v18+) - For frontend and backend
- **Python** (v3.8+) - For AI service
- **Git Bash** (Windows) - For running shell scripts on Windows

### System Requirements:
- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 5GB free space
- **Ports:** Ensure ports 3000, 6379, 7474, 7687, 8000, 8001, 8080, 9000, 9001, 9200 are available

## Troubleshooting

### Port Conflicts
If you get port conflict errors:
1. Check what's using the ports: `netstat -tulpn` (Linux/macOS) or `netstat -an` (Windows)
2. Stop the conflicting services or change ports in the configuration
3. Use `./stop.sh force` to clean up any stuck processes

### Docker Issues
If Docker services fail to start:
1. Ensure Docker Desktop is running
2. Check available disk space
3. Try: `docker system prune` to clean up
4. Restart Docker Desktop if needed

### Permission Issues (Linux/macOS)
If you get permission errors:
```bash
chmod +x start.sh stop.sh
```

### Memory Issues
If services crash due to memory:
1. Close other applications
2. Increase Docker memory limits in Docker Desktop settings
3. Consider running only essential services for development

## Logs and Debugging

### Log Locations:
- **Application logs:** `logs/` directory
  - `backend.log` - Backend service logs
  - `ai.log` - AI service logs
  - `frontend.log` - Frontend service logs
- **Docker logs:** `docker-compose logs [service-name]`

### Common Debug Commands:
```bash
# Check service status
docker-compose -f docker-compose.dev.yml ps

# View service logs
docker-compose -f docker-compose.dev.yml logs [service-name]

# Check if ports are in use
netstat -tulpn | grep -E ':(3000|8000|8001|5432|7474|8080|9200|6379|9000)'

# Check Docker resource usage
docker stats
```

## Development Workflow

### Typical Development Session:
1. Start infrastructure: `npm run start:docker`
2. Start your specific service for development:
   - Frontend: `cd frontend && npm run dev`
   - Backend: `cd backend && npm run dev`
   - AI Service: `cd ai && python -m uvicorn main:app --reload --port 8001`
3. When done: `npm run stop:docker`

### Full System Testing:
1. Start everything: `npm start`
2. Test all integrations
3. Stop everything: `npm stop`

## Security Notes

- Default passwords are used for development (change for production)
- Services are exposed on localhost only
- No authentication is configured by default
- This setup is intended for development only

## Contributing

When modifying these scripts:
1. Test on both Windows and Unix-like systems
2. Update this README if adding new features
3. Ensure graceful shutdown to prevent data corruption
4. Add appropriate error handling and user feedback

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in the `logs/` directory
3. Ensure all prerequisites are installed
4. Try a clean restart: `npm stop && npm start`
