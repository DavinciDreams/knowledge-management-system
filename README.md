# Knowledge Management System

A comprehensive self-hosted knowledge management web application combining OneNote's universal data import, infinite canvas with robust pen input, Excalidraw-like diagramming, Notion's publishing capabilities, and AI-first knowledge base with voice interaction.

## Features

### Core Capabilities
- **Infinite Canvas**: OneNote-like infinite canvas with pen input, pressure sensitivity, and low-latency drawing
- **AI-Powered Knowledge Base**: Vector search with Weaviate, entity extraction, and Llama-based chat
- **Voice Interaction**: Web Audio API recording, Whisper transcription, EasySpeech synthesis
- **Knowledge Graph**: Interactive Neo4j-based visualization with D3.js
- **Real-time Collaboration**: WebSocket-based CRDT for seamless multi-user editing
- **Universal Data Import**: Support for PDFs, videos, social media posts, and more

### AI Features
- **Smart Entity Extraction**: Names, dates, locations, phone numbers for calendar integration
- **Intelligent Recommendations**: TensorFlow-based suggestions for related content
- **Voice Commands**: Natural language processing for hands-free operation
- **CV Overview**: Automated work summary generation from notebook content

### Technical Highlights
- **Performance**: <100ms pen stroke latency, <200ms voice processing, <2s page loads
- **Privacy**: Self-hosted with end-to-end encryption, no external dependencies
- **Scalability**: Designed for 10 concurrent users with real-time sync

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+
- Docker & Docker Compose
- GPU with 12GB+ VRAM (for AI models)

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd knowledge-management-system
   npm run setup
   ```

2. **Start services**:
   ```bash
   # Development mode
   npm run docker:dev
   npm run dev
   
   # Production mode
   npm run docker:prod
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - AI Service: http://localhost:8001

## Architecture

### Frontend (React + TypeScript)
- **Canvas**: Fabric.js for infinite canvas and pen input
- **Graph Visualization**: D3.js for interactive knowledge graphs
- **Voice**: Web Audio API + Howler.js for audio handling
- **UI**: Tailwind CSS with responsive design

### Backend (Node.js + Express)
- **Microservices**: Note, Canvas, Graph, AI, Voice, Calendar services
- **Real-time**: WebSocket with CRDT for collaboration
- **Security**: OAuth 2.0, HTTPS, encryption at rest

### AI Services (FastAPI + Python)
- **Models**: Llama (Ollama), Whisper, BERT, Sentence-BERT
- **Vector Search**: Weaviate for semantic relationships
- **Entity Extraction**: Hugging Face NER models

### Data Storage
- **PostgreSQL**: Structured data and calendar events
- **Neo4j**: Knowledge graph relationships
- **Weaviate**: Vector embeddings and semantic search
- **MinIO**: File storage (documents, audio, sketches)
- **Elasticsearch**: Full-text search

## Development

### Project Structure
```
knowledge-management-system/
├── frontend/          # React application
├── backend/           # Node.js API server
├── ai-service/        # Python AI services
├── browser-extension/ # Web extension for clipping
├── docker/           # Docker configurations
├── k8s/             # Kubernetes manifests
└── docs/            # Documentation
```

### Key Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS, Fabric.js, D3.js
- **Backend**: Node.js 20, Express, WebSocket
- **AI**: Llama, Whisper, EasySpeech, Hugging Face
- **Databases**: PostgreSQL, Neo4j, Weaviate, Elasticsearch
- **Infrastructure**: Docker, Kubernetes, Nginx

## Contributing

1. Follow the development rules in `DEVELOPMENT_RULES.md`
2. Run tests before submitting PRs
3. Ensure <100ms pen latency and <200ms voice latency
4. Maintain >80% test coverage

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please check the documentation in the `docs/` directory or create an issue in the repository.
