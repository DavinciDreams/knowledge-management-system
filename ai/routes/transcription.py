"""
Transcription API routes for voice processing
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Optional, List
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    audio: UploadFile = File(...),
    language: Optional[str] = None,
    task: str = "transcribe",
    word_timestamps: bool = True
):
    """
    Transcribe audio file to text
    
    Args:
        audio: Audio file (mp3, wav, m4a, etc.)
        language: Language code (e.g., 'en', 'es', 'fr') or auto-detect
        task: 'transcribe' or 'translate'
        word_timestamps: Include word-level timestamps
    """
    try:
        whisper_service = request.app.state.whisper
        
        if not whisper_service:
            raise HTTPException(status_code=503, detail="Whisper service not available")
        
        # Validate file type
        if not audio.content_type or not audio.content_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1]) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Transcribe audio
            result = await whisper_service.transcribe(
                audio_path=temp_path,
                language=language,
                task=task,
                word_timestamps=word_timestamps
            )
            
            return JSONResponse(content={
                "success": True,
                "transcription": result,
                "filename": audio.filename,
                "file_size": len(content)
            })
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/transcribe-stream")
async def transcribe_stream(
    request: Request,
    audio: UploadFile = File(...),
    language: Optional[str] = None,
    chunk_duration: float = 10.0
):
    """
    Transcribe audio with streaming/chunked processing
    """
    try:
        whisper_service = request.app.state.whisper
        
        if not whisper_service:
            raise HTTPException(status_code=503, detail="Whisper service not available")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1]) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Process in chunks for long audio
            result = await whisper_service.transcribe_chunked(
                audio_path=temp_path,
                language=language,
                chunk_duration=chunk_duration
            )
            
            return JSONResponse(content={
                "success": True,
                "transcription": result,
                "filename": audio.filename,
                "processing_method": "chunked"
            })
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Stream transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Stream transcription failed: {str(e)}")


@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported languages for transcription"""
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ru", "name": "Russian"},
            {"code": "ja", "name": "Japanese"},
            {"code": "ko", "name": "Korean"},
            {"code": "zh", "name": "Chinese"},
            {"code": "ar", "name": "Arabic"},
            {"code": "hi", "name": "Hindi"},
            {"code": "auto", "name": "Auto-detect"}
        ]
    }


@router.post("/detect-language")
async def detect_language(request: Request, audio: UploadFile = File(...)):
    """Detect the language of an audio file"""
    try:
        whisper_service = request.app.state.whisper
        
        if not whisper_service:
            raise HTTPException(status_code=503, detail="Whisper service not available")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1]) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Detect language
            language_info = await whisper_service.detect_language(temp_path)
            
            return JSONResponse(content={
                "success": True,
                "language": language_info,
                "filename": audio.filename
            })
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Language detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Language detection failed: {str(e)}")


@router.get("/transcription-history")
async def get_transcription_history(request: Request, limit: int = 10):
    """Get recent transcription history (if implemented in service)"""
    try:
        whisper_service = request.app.state.whisper
        
        if not whisper_service:
            raise HTTPException(status_code=503, detail="Whisper service not available")
        
        # This would require implementing history tracking in the service
        return {
            "message": "Transcription history not yet implemented",
            "limit": limit
        }
    
    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")
