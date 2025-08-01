import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """AI Service Configuration"""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False
    
    # AI Model settings
    whisper_model: str = "base"  # tiny, base, small, medium, large
    whisper_device: str = "auto"  # auto, cpu, cuda
    
    # Ollama settings
    ollama_host: str = "http://localhost:11434"
    llama_model: str = "llama2"
    
    # Hugging Face models
    ner_model: str = "dbmdz/bert-large-cased-finetuned-conll03-english"
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Weaviate settings
    weaviate_url: str = "http://localhost:8080"
    weaviate_api_key: Optional[str] = None
    
    # YouTube API
    youtube_api_key: Optional[str] = None
    
    # Redis settings
    redis_url: str = "redis://localhost:6379"
    
    # File storage
    upload_dir: str = "uploads"
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    
    # Processing settings
    max_transcript_length: int = 10000
    batch_size: int = 32
    cache_ttl: int = 3600  # 1 hour
      # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
