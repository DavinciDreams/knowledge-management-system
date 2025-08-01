"""
Content ingestion API routes for adding content to the knowledge base
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import tempfile
import os
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()


class TextIngestionRequest(BaseModel):
    content: str
    title: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    content_type: str = "text"


class URLIngestionRequest(BaseModel):
    url: str
    extract_content: bool = True
    include_metadata: bool = True


class YouTubeIngestionRequest(BaseModel):
    url: str
    include_transcript: bool = True
    include_metadata: bool = True


class BulkIngestionRequest(BaseModel):
    items: List[TextIngestionRequest]
    batch_size: Optional[int] = 10


@router.post("/text")
async def ingest_text(request: Request, ingestion_request: TextIngestionRequest):
    """
    Ingest text content into the knowledge base
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        # Store the document
        document_id = await weaviate_service.store_document(
            content=ingestion_request.content,
            title=ingestion_request.title,
            source=ingestion_request.source,
            metadata=ingestion_request.metadata or {},
            content_type=ingestion_request.content_type
        )
        
        return JSONResponse(content={
            "success": True,
            "document_id": document_id,
            "content_length": len(ingestion_request.content),
            "title": ingestion_request.title,
            "content_type": ingestion_request.content_type
        })
    
    except Exception as e:
        logger.error(f"Text ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Text ingestion failed: {str(e)}")


@router.post("/file")
async def ingest_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    source: Optional[str] = None,
    extract_entities: bool = True
):
    """
    Ingest a file into the knowledge base
    """
    try:
        weaviate_service = request.app.state.weaviate
        entity_service = request.app.state.entity
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        try:
            # Extract text content based on file type
            if file.content_type == "text/plain":
                text_content = content.decode('utf-8')
            elif file.content_type == "application/json":
                data = json.loads(content.decode('utf-8'))
                text_content = json.dumps(data, indent=2)
            else:
                # For other file types, you might want to use libraries like
                # python-docx, PyPDF2, etc.
                text_content = content.decode('utf-8', errors='ignore')
            
            # Prepare metadata
            metadata = {
                "filename": file.filename,
                "content_type": file.content_type,
                "file_size": len(content),
                "source": source or "file_upload"
            }
            
            # Store the document
            document_id = await weaviate_service.store_document(
                content=text_content,
                title=title or file.filename,
                source="file_upload",
                metadata=metadata,
                content_type="document"
            )
            
            # Extract entities in the background if requested
            if extract_entities and entity_service:
                background_tasks.add_task(
                    extract_and_store_entities,
                    entity_service,
                    weaviate_service,
                    text_content,
                    document_id
                )
            
            return JSONResponse(content={
                "success": True,
                "document_id": document_id,
                "filename": file.filename,
                "content_length": len(text_content),
                "file_size": len(content),
                "entities_extraction": "queued" if extract_entities else "skipped"
            })
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"File ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"File ingestion failed: {str(e)}")


@router.post("/youtube")
async def ingest_youtube(request: Request, youtube_request: YouTubeIngestionRequest):
    """
    Ingest YouTube video content
    """
    try:
        youtube_service = request.app.state.youtube
        weaviate_service = request.app.state.weaviate
        
        if not youtube_service or not weaviate_service:
            raise HTTPException(status_code=503, detail="Required services not available")
        
        # Process YouTube video
        video_data = await youtube_service.process_video(youtube_request.url)
        
        if not video_data:
            raise HTTPException(status_code=400, detail="Failed to process YouTube video")
        
        # Prepare content for storage
        content_parts = [video_data.get("title", "")]
        
        if video_data.get("description"):
            content_parts.append(video_data["description"])
        
        if youtube_request.include_transcript and video_data.get("transcript"):
            transcript = video_data["transcript"]
            content_parts.append(transcript.get("full_text", ""))
        
        content = "\n\n".join(filter(None, content_parts))
        
        # Prepare metadata
        metadata = {
            **video_data,
            "source_type": "youtube",
            "url": youtube_request.url,
            "ingested_transcript": youtube_request.include_transcript,
            "ingested_metadata": youtube_request.include_metadata
        }
        
        # Store the document
        document_id = await weaviate_service.store_document(
            content=content,
            title=video_data.get("title", "YouTube Video"),
            source="youtube",
            metadata=metadata,
            content_type="video"
        )
        
        return JSONResponse(content={
            "success": True,
            "document_id": document_id,
            "video_id": video_data.get("id"),
            "title": video_data.get("title"),
            "duration": video_data.get("duration"),
            "has_transcript": video_data.get("has_transcript"),
            "content_length": len(content)
        })
    
    except Exception as e:
        logger.error(f"YouTube ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"YouTube ingestion failed: {str(e)}")


@router.post("/url")
async def ingest_url(request: Request, url_request: URLIngestionRequest):
    """
    Ingest content from a URL
    """
    try:
        # This would require implementing web scraping functionality
        # For now, return a placeholder response
        return JSONResponse(content={
            "success": False,
            "message": "URL ingestion not yet implemented",
            "url": url_request.url
        })
    
    except Exception as e:
        logger.error(f"URL ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"URL ingestion failed: {str(e)}")


@router.post("/voice-note")
async def ingest_voice_note(
    request: Request,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    title: Optional[str] = None,
    transcribe: bool = True
):
    """
    Ingest a voice note
    """
    try:
        whisper_service = request.app.state.whisper
        weaviate_service = request.app.state.weaviate
        entity_service = request.app.state.entity
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        content = ""
        transcription_data = None
        
        if transcribe and whisper_service:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename)[1]) as temp_file:
                audio_content = await audio.read()
                temp_file.write(audio_content)
                temp_path = temp_file.name
            
            try:
                # Transcribe the audio
                transcription_data = await whisper_service.transcribe(temp_path)
                content = transcription_data.get("text", "")
            finally:
                # Cleanup temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
        
        # Prepare metadata
        metadata = {
            "filename": audio.filename,
            "content_type": audio.content_type,
            "source_type": "voice_note",
            "transcribed": transcribe,
            "transcription_data": transcription_data
        }
        
        # Store the document
        document_id = await weaviate_service.store_document(
            content=content,
            title=title or f"Voice Note - {audio.filename}",
            source="voice_note",
            metadata=metadata,
            content_type="voice_note"
        )
        
        # Extract entities in the background if we have transcribed content
        if content and entity_service:
            background_tasks.add_task(
                extract_and_store_entities,
                entity_service,
                weaviate_service,
                content,
                document_id
            )
        
        return JSONResponse(content={
            "success": True,
            "document_id": document_id,
            "filename": audio.filename,
            "transcribed": transcribe,
            "content_length": len(content),
            "transcription_language": transcription_data.get("language") if transcription_data else None
        })
    
    except Exception as e:
        logger.error(f"Voice note ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Voice note ingestion failed: {str(e)}")


@router.post("/bulk")
async def ingest_bulk(request: Request, bulk_request: BulkIngestionRequest):
    """
    Ingest multiple text items in bulk
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        results = []
        batch_size = bulk_request.batch_size or 10
        
        # Process in batches
        for i in range(0, len(bulk_request.items), batch_size):
            batch = bulk_request.items[i:i + batch_size]
            
            for item in batch:
                try:
                    document_id = await weaviate_service.store_document(
                        content=item.content,
                        title=item.title,
                        source=item.source,
                        metadata=item.metadata or {},
                        content_type=item.content_type
                    )
                    
                    results.append({
                        "success": True,
                        "document_id": document_id,
                        "title": item.title,
                        "content_length": len(item.content)
                    })
                    
                except Exception as e:
                    results.append({
                        "success": False,
                        "error": str(e),
                        "title": item.title
                    })
        
        successful = len([r for r in results if r["success"]])
        failed = len(results) - successful
        
        return JSONResponse(content={
            "success": True,
            "total_items": len(bulk_request.items),
            "successful": successful,
            "failed": failed,
            "results": results
        })
    
    except Exception as e:
        logger.error(f"Bulk ingestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk ingestion failed: {str(e)}")


@router.get("/status/{document_id}")
async def get_ingestion_status(request: Request, document_id: str):
    """
    Get the status of an ingested document
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        # Check if document exists
        document = await weaviate_service.get_document(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return JSONResponse(content={
            "success": True,
            "document_id": document_id,
            "status": "completed",
            "document": document
        })
    
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


async def extract_and_store_entities(entity_service, weaviate_service, content: str, document_id: str):
    """
    Background task to extract entities and store them
    """
    try:
        entities_result = await entity_service.extract_entities(content)
        
        # Store entities as metadata
        await weaviate_service.update_document_metadata(
            document_id=document_id,
            metadata_update={"extracted_entities": entities_result}
        )
        
        logger.info(f"Entities extracted and stored for document {document_id}")
        
    except Exception as e:
        logger.error(f"Background entity extraction failed for {document_id}: {e}")
