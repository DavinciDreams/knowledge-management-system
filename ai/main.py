from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import logging
from contextlib import asynccontextmanager

from config import settings
from services.whisper_service import WhisperService
from services.llama_service import LlamaService
from services.ner_service import NERService
from services.weaviate_service import WeaviateService
from services.youtube_service import YouTubeService
from services.entity_extraction import EntityExtractionService
from routes import transcription, chat, entities, search, ingestion, overview
from utils.logger import setup_logger


# Setup logging
logger = setup_logger(__name__)

# Global service instances
whisper_service = None
llama_service = None
ner_service = None
weaviate_service = None
youtube_service = None
entity_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup and cleanup on shutdown"""
    global whisper_service, llama_service, ner_service, weaviate_service, youtube_service, entity_service
    
    logger.info("Starting AI microservice...")
    
    try:
        # Initialize services
        logger.info("Initializing Whisper service...")
        whisper_service = WhisperService()
        await whisper_service.initialize()
        
        logger.info("Initializing Llama service...")
        llama_service = LlamaService()
        await llama_service.initialize()
        
        logger.info("Initializing NER service...")
        ner_service = NERService()
        await ner_service.initialize()
        
        logger.info("Initializing Weaviate service...")
        weaviate_service = WeaviateService()
        await weaviate_service.initialize()
        
        logger.info("Initializing YouTube service...")
        youtube_service = YouTubeService()
        
        logger.info("Initializing Entity extraction service...")
        entity_service = EntityExtractionService(ner_service)
        
        # Store services in app state
        app.state.whisper = whisper_service
        app.state.llama = llama_service
        app.state.ner = ner_service
        app.state.weaviate = weaviate_service
        app.state.youtube = youtube_service
        app.state.entity = entity_service
        
        logger.info("AI microservice initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize AI services: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI microservice...")
    if weaviate_service:
        await weaviate_service.close()


# Create FastAPI app
app = FastAPI(
    title="Knowledge Management AI Service",
    description="AI microservice for transcription, chat, entity extraction, and knowledge processing",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(transcription.router, prefix="/api/voice", tags=["voice"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(entities.router, prefix="/api/entities", tags=["entities"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["ingestion"])
app.include_router(overview.router, prefix="/api/overview", tags=["overview"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Knowledge Management AI Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    status = {
        "status": "healthy",
        "services": {}
    }
    
    try:
        # Check each service
        if app.state.whisper:
            status["services"]["whisper"] = "ready"
        
        if app.state.llama:
            status["services"]["llama"] = "ready"
            
        if app.state.ner:
            status["services"]["ner"] = "ready"
            
        if app.state.weaviate:
            is_ready = await app.state.weaviate.health_check()
            status["services"]["weaviate"] = "ready" if is_ready else "unavailable"
            
        return status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
