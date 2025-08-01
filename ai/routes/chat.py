"""
Chat API routes for LLM interactions
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False


class SummarizeRequest(BaseModel):
    text: str
    style: Optional[str] = "concise"  # "concise", "detailed", "bullet_points"
    max_length: Optional[int] = None


class GenerateRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 500


@router.post("/chat")
async def chat(request: Request, chat_request: ChatRequest):
    """
    Chat with the LLM
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        if chat_request.stream:
            # Streaming response
            async def generate_stream():
                async for chunk in llama_service.chat_stream(
                    messages=[msg.dict() for msg in chat_request.messages],
                    model=chat_request.model,
                    temperature=chat_request.temperature,
                    max_tokens=chat_request.max_tokens
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream"
                }
            )
        else:
            # Regular response
            result = await llama_service.chat(
                messages=[msg.dict() for msg in chat_request.messages],
                model=chat_request.model,
                temperature=chat_request.temperature,
                max_tokens=chat_request.max_tokens
            )
            
            return JSONResponse(content={
                "success": True,
                "response": result
            })
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.post("/summarize")
async def summarize_text(request: Request, summarize_request: SummarizeRequest):
    """
    Summarize text content
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        result = await llama_service.summarize(
            text=summarize_request.text,
            style=summarize_request.style,
            max_length=summarize_request.max_length
        )
        
        return JSONResponse(content={
            "success": True,
            "summary": result,
            "original_length": len(summarize_request.text),
            "summary_length": len(result.get("summary", "")),
            "compression_ratio": len(result.get("summary", "")) / len(summarize_request.text) if summarize_request.text else 0
        })
    
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@router.post("/generate")
async def generate_text(request: Request, generate_request: GenerateRequest):
    """
    Generate text from a prompt
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        result = await llama_service.generate(
            prompt=generate_request.prompt,
            context=generate_request.context,
            temperature=generate_request.temperature,
            max_tokens=generate_request.max_tokens
        )
        
        return JSONResponse(content={
            "success": True,
            "generated_text": result,
            "prompt_length": len(generate_request.prompt)
        })
    
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Text generation failed: {str(e)}")


@router.post("/classify")
async def classify_content(request: Request, text: str, categories: Optional[List[str]] = None):
    """
    Classify content into categories
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        if not categories:
            categories = [
                "meeting", "email", "document", "task", "note", 
                "idea", "research", "personal", "work", "other"
            ]
        
        result = await llama_service.classify(
            text=text,
            categories=categories
        )
        
        return JSONResponse(content={
            "success": True,
            "classification": result,
            "text_length": len(text),
            "categories_considered": categories
        })
    
    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@router.get("/models")
async def get_available_models(request: Request):
    """
    Get list of available LLM models
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        models = await llama_service.list_models()
        
        return JSONResponse(content={
            "success": True,
            "models": models
        })
    
    except Exception as e:
        logger.error(f"Model listing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get models: {str(e)}")


@router.post("/analyze-sentiment")
async def analyze_sentiment(request: Request, text: str):
    """
    Analyze sentiment of text
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        # Use LLM to analyze sentiment
        messages = [
            {
                "role": "system",
                "content": "You are a sentiment analysis expert. Analyze the sentiment of the given text and respond with a JSON object containing 'sentiment' (positive/negative/neutral), 'confidence' (0-1), and 'explanation'."
            },
            {
                "role": "user", 
                "content": f"Analyze the sentiment of this text: {text}"
            }
        ]
        
        result = await llama_service.chat(messages=messages, temperature=0.1)
        
        return JSONResponse(content={
            "success": True,
            "sentiment_analysis": result,
            "text_length": len(text)
        })
    
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


@router.post("/extract-keywords")
async def extract_keywords(request: Request, text: str, max_keywords: int = 10):
    """
    Extract keywords from text
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        # Use LLM to extract keywords
        messages = [
            {
                "role": "system",
                "content": f"You are a keyword extraction expert. Extract the {max_keywords} most important keywords from the given text. Respond with a JSON array of keywords."
            },
            {
                "role": "user",
                "content": f"Extract keywords from this text: {text}"
            }
        ]
        
        result = await llama_service.chat(messages=messages, temperature=0.1)
        
        return JSONResponse(content={
            "success": True,
            "keywords": result,
            "text_length": len(text),
            "max_keywords": max_keywords
        })
    
    except Exception as e:
        logger.error(f"Keyword extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Keyword extraction failed: {str(e)}")
