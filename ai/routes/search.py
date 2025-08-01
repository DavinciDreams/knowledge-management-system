"""
Search API routes for semantic search and knowledge retrieval
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10
    threshold: Optional[float] = 0.7
    filter_type: Optional[str] = None  # "document", "voice_note", "video", etc.


class SimilarityRequest(BaseModel):
    text: str
    target_texts: List[str]
    threshold: Optional[float] = 0.5


class DocumentSearchRequest(BaseModel):
    query: str
    document_types: Optional[List[str]] = None
    date_range: Optional[Dict[str, str]] = None
    limit: Optional[int] = 10


@router.post("/semantic")
async def semantic_search(request: Request, search_request: SearchRequest):
    """
    Perform semantic search across the knowledge base
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        results = await weaviate_service.semantic_search(
            query=search_request.query,
            limit=search_request.limit,
            threshold=search_request.threshold,
            filter_type=search_request.filter_type
        )
        
        return JSONResponse(content={
            "success": True,
            "query": search_request.query,
            "results": results,
            "result_count": len(results),
            "threshold": search_request.threshold
        })
    
    except Exception as e:
        logger.error(f"Semantic search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/similarity")
async def calculate_similarity(request: Request, similarity_request: SimilarityRequest):
    """
    Calculate similarity between texts
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        similarities = []
        
        for target_text in similarity_request.target_texts:
            similarity = await weaviate_service.calculate_similarity(
                text1=similarity_request.text,
                text2=target_text
            )
            
            similarities.append({
                "target_text": target_text,
                "similarity_score": similarity,
                "above_threshold": similarity >= similarity_request.threshold
            })
        
        # Sort by similarity score
        similarities.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        return JSONResponse(content={
            "success": True,
            "base_text": similarity_request.text,
            "similarities": similarities,
            "threshold": similarity_request.threshold,
            "matches_above_threshold": len([s for s in similarities if s["above_threshold"]])
        })
    
    except Exception as e:
        logger.error(f"Similarity calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"Similarity calculation failed: {str(e)}")


@router.post("/find-related")
async def find_related_content(request: Request, text: str, limit: int = 5):
    """
    Find content related to the given text
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        related_content = await weaviate_service.find_related(
            text=text,
            limit=limit
        )
        
        return JSONResponse(content={
            "success": True,
            "source_text": text,
            "related_content": related_content,
            "found_count": len(related_content)
        })
    
    except Exception as e:
        logger.error(f"Related content search error: {e}")
        raise HTTPException(status_code=500, detail=f"Related content search failed: {str(e)}")


@router.post("/hybrid")
async def hybrid_search(request: Request, query: str, limit: int = 10, alpha: float = 0.5):
    """
    Perform hybrid search (combining semantic and keyword search)
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        results = await weaviate_service.hybrid_search(
            query=query,
            limit=limit,
            alpha=alpha
        )
        
        return JSONResponse(content={
            "success": True,
            "query": query,
            "results": results,
            "search_type": "hybrid",
            "alpha": alpha,
            "result_count": len(results)
        })
    
    except Exception as e:
        logger.error(f"Hybrid search error: {e}")
        raise HTTPException(status_code=500, detail=f"Hybrid search failed: {str(e)}")


@router.get("/collections")
async def get_collections(request: Request):
    """
    Get available collections in the knowledge base
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        collections = await weaviate_service.list_collections()
        
        return JSONResponse(content={
            "success": True,
            "collections": collections
        })
    
    except Exception as e:
        logger.error(f"Collections retrieval error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get collections: {str(e)}")


@router.get("/stats")
async def get_search_stats(request: Request):
    """
    Get search and knowledge base statistics
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        stats = await weaviate_service.get_stats()
        
        return JSONResponse(content={
            "success": True,
            "stats": stats
        })
    
    except Exception as e:
        logger.error(f"Stats retrieval error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/search-by-type")
async def search_by_type(request: Request, search_request: DocumentSearchRequest):
    """
    Search for specific types of documents
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        # Build filters
        filters = {}
        
        if search_request.document_types:
            filters["type"] = search_request.document_types
        
        if search_request.date_range:
            filters["date_range"] = search_request.date_range
        
        results = await weaviate_service.search_with_filters(
            query=search_request.query,
            filters=filters,
            limit=search_request.limit
        )
        
        return JSONResponse(content={
            "success": True,
            "query": search_request.query,
            "filters": filters,
            "results": results,
            "result_count": len(results)
        })
    
    except Exception as e:
        logger.error(f"Filtered search error: {e}")
        raise HTTPException(status_code=500, detail=f"Filtered search failed: {str(e)}")


@router.post("/recommend")
async def recommend_content(request: Request, based_on: str, limit: int = 5):
    """
    Recommend content based on given text or document
    """
    try:
        weaviate_service = request.app.state.weaviate
        
        if not weaviate_service:
            raise HTTPException(status_code=503, detail="Weaviate service not available")
        
        recommendations = await weaviate_service.recommend(
            based_on=based_on,
            limit=limit
        )
        
        return JSONResponse(content={
            "success": True,
            "based_on": based_on,
            "recommendations": recommendations,
            "recommendation_count": len(recommendations)
        })
    
    except Exception as e:
        logger.error(f"Content recommendation error: {e}")
        raise HTTPException(status_code=500, detail=f"Content recommendation failed: {str(e)}")


@router.delete("/clear-cache")
async def clear_search_cache(request: Request):
    """
    Clear search cache (if implemented)
    """
    try:
        # This would clear any search caching
        return JSONResponse(content={
            "success": True,
            "message": "Search cache cleared"
        })
    
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
