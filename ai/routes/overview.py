"""
Overview and CV generation API routes
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class CVGenerationRequest(BaseModel):
    content: str
    style: Optional[str] = "professional"  # "professional", "academic", "creative"
    length: Optional[str] = "medium"  # "short", "medium", "long"
    focus_areas: Optional[List[str]] = None


class OverviewRequest(BaseModel):
    content: str
    overview_type: Optional[str] = "summary"  # "summary", "highlights", "key_points"
    target_audience: Optional[str] = "general"


class PersonalityAnalysisRequest(BaseModel):
    content: str
    analysis_depth: Optional[str] = "standard"  # "basic", "standard", "detailed"


@router.post("/generate-cv")
async def generate_cv_overview(request: Request, cv_request: CVGenerationRequest):
    """
    Generate a CV overview from content
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        result = await llama_service.generate_cv_overview(
            content=cv_request.content,
            style=cv_request.style,
            length=cv_request.length,
            focus_areas=cv_request.focus_areas
        )
        
        return JSONResponse(content={
            "success": True,
            "cv_overview": result,
            "style": cv_request.style,
            "length": cv_request.length,
            "content_length": len(cv_request.content)
        })
    
    except Exception as e:
        logger.error(f"CV generation error: {e}")
        raise HTTPException(status_code=500, detail=f"CV generation failed: {str(e)}")


@router.post("/content-overview")
async def generate_content_overview(request: Request, overview_request: OverviewRequest):
    """
    Generate an overview of content
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        # Use summarization with specific styling
        result = await llama_service.summarize(
            text=overview_request.content,
            style=overview_request.overview_type,
            max_length=None
        )
        
        # Enhance with additional analysis
        messages = [
            {
                "role": "system",
                "content": f"You are creating a {overview_request.overview_type} for a {overview_request.target_audience} audience. Be clear and concise."
            },
            {
                "role": "user",
                "content": f"Create a {overview_request.overview_type} of this content:\n\n{overview_request.content}"
            }
        ]
        
        enhanced_overview = await llama_service.chat(
            messages=messages,
            temperature=0.3
        )
        
        return JSONResponse(content={
            "success": True,
            "overview": enhanced_overview,
            "summary": result,
            "overview_type": overview_request.overview_type,
            "target_audience": overview_request.target_audience,
            "content_length": len(overview_request.content)
        })
    
    except Exception as e:
        logger.error(f"Overview generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Overview generation failed: {str(e)}")


@router.post("/knowledge-map")
async def generate_knowledge_map(request: Request, content: str, max_concepts: int = 20):
    """
    Generate a knowledge map from content
    """
    try:
        llama_service = request.app.state.llama
        entity_service = request.app.state.entity
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        # Extract entities first
        entities_result = None
        if entity_service:
            entities_result = await entity_service.extract_entities(content, include_calendar=False)
        
        # Generate knowledge map using LLM
        messages = [
            {
                "role": "system",
                "content": f"You are a knowledge mapping expert. Extract the {max_concepts} most important concepts, ideas, and relationships from the given content. Return a JSON structure with 'concepts' and 'relationships'."
            },
            {
                "role": "user",
                "content": f"Create a knowledge map from this content:\n\n{content}"
            }
        ]
        
        knowledge_map = await llama_service.chat(
            messages=messages,
            temperature=0.2
        )
        
        return JSONResponse(content={
            "success": True,
            "knowledge_map": knowledge_map,
            "entities": entities_result.get("entities", []) if entities_result else [],
            "content_length": len(content),
            "max_concepts": max_concepts
        })
    
    except Exception as e:
        logger.error(f"Knowledge map generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Knowledge map generation failed: {str(e)}")


@router.post("/personality-analysis")
async def analyze_personality(request: Request, analysis_request: PersonalityAnalysisRequest):
    """
    Analyze personality from content (writing style, preferences, etc.)
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        messages = [
            {
                "role": "system",
                "content": f"You are a personality analysis expert. Analyze the writing style, communication patterns, interests, and personality traits from the given content. Provide a {analysis_request.analysis_depth} analysis in JSON format."
            },
            {
                "role": "user",
                "content": f"Analyze the personality and characteristics from this content:\n\n{analysis_request.content}"
            }
        ]
        
        personality_analysis = await llama_service.chat(
            messages=messages,
            temperature=0.3
        )
        
        return JSONResponse(content={
            "success": True,
            "personality_analysis": personality_analysis,
            "analysis_depth": analysis_request.analysis_depth,
            "content_length": len(analysis_request.content)
        })
    
    except Exception as e:
        logger.error(f"Personality analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Personality analysis failed: {str(e)}")


@router.post("/content-insights")
async def generate_content_insights(request: Request, content: str, insight_types: List[str] = None):
    """
    Generate various insights from content
    """
    try:
        llama_service = request.app.state.llama
        entity_service = request.app.state.entity
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        if not insight_types:
            insight_types = ["themes", "sentiment", "complexity", "topics"]
        
        insights = {}
        
        # Generate insights based on requested types
        for insight_type in insight_types:
            if insight_type == "themes":
                messages = [
                    {
                        "role": "system",
                        "content": "Extract the main themes and recurring ideas from the content. Return a JSON array of themes with descriptions."
                    },
                    {
                        "role": "user",
                        "content": f"Extract themes from: {content}"
                    }
                ]
                insights["themes"] = await llama_service.chat(messages=messages, temperature=0.2)
            
            elif insight_type == "sentiment":
                messages = [
                    {
                        "role": "system",
                        "content": "Analyze the overall sentiment and emotional tone of the content. Return a JSON object with sentiment, confidence, and explanation."
                    },
                    {
                        "role": "user",
                        "content": f"Analyze sentiment of: {content}"
                    }
                ]
                insights["sentiment"] = await llama_service.chat(messages=messages, temperature=0.1)
            
            elif insight_type == "complexity":
                messages = [
                    {
                        "role": "system",
                        "content": "Analyze the complexity and readability of the content. Consider vocabulary, sentence structure, and concepts. Return a JSON object with complexity level and explanation."
                    },
                    {
                        "role": "user",
                        "content": f"Analyze complexity of: {content}"
                    }
                ]
                insights["complexity"] = await llama_service.chat(messages=messages, temperature=0.2)
            
            elif insight_type == "topics":
                messages = [
                    {
                        "role": "system",
                        "content": "Identify the main topics and subject areas covered in the content. Return a JSON array of topics with relevance scores."
                    },
                    {
                        "role": "user",
                        "content": f"Identify topics in: {content}"
                    }
                ]
                insights["topics"] = await llama_service.chat(messages=messages, temperature=0.2)
        
        # Add entity analysis if available
        if entity_service:
            entities_result = await entity_service.extract_entities(content, include_calendar=False)
            insights["entities"] = entities_result
        
        return JSONResponse(content={
            "success": True,
            "insights": insights,
            "insight_types": insight_types,
            "content_length": len(content)
        })
    
    except Exception as e:
        logger.error(f"Content insights error: {e}")
        raise HTTPException(status_code=500, detail=f"Content insights generation failed: {str(e)}")


@router.post("/learning-objectives")
async def extract_learning_objectives(request: Request, content: str, subject_area: Optional[str] = None):
    """
    Extract learning objectives and educational content from text
    """
    try:
        llama_service = request.app.state.llama
        
        if not llama_service:
            raise HTTPException(status_code=503, detail="LLaMA service not available")
        
        subject_context = f" in the context of {subject_area}" if subject_area else ""
        
        messages = [
            {
                "role": "system",
                "content": f"You are an educational content expert. Extract learning objectives, key concepts, and educational value from the content{subject_context}. Return a JSON object with learning_objectives, key_concepts, difficulty_level, and suggested_activities."
            },
            {
                "role": "user",
                "content": f"Extract learning objectives from this content:\n\n{content}"
            }
        ]
        
        learning_analysis = await llama_service.chat(
            messages=messages,
            temperature=0.3
        )
        
        return JSONResponse(content={
            "success": True,
            "learning_analysis": learning_analysis,
            "subject_area": subject_area,
            "content_length": len(content)
        })
    
    except Exception as e:
        logger.error(f"Learning objectives extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Learning objectives extraction failed: {str(e)}")


@router.get("/overview-templates")
async def get_overview_templates():
    """
    Get available overview templates and styles
    """
    return {
        "cv_styles": [
            {"style": "professional", "description": "Formal business CV format"},
            {"style": "academic", "description": "Academic and research focused"},
            {"style": "creative", "description": "Creative and visual fields"}
        ],
        "cv_lengths": [
            {"length": "short", "description": "Concise 1-page summary"},
            {"length": "medium", "description": "Standard 2-3 page format"},
            {"length": "long", "description": "Comprehensive detailed version"}
        ],
        "overview_types": [
            {"type": "summary", "description": "General summary overview"},
            {"type": "highlights", "description": "Key highlights and achievements"},
            {"type": "key_points", "description": "Bullet point key takeaways"}
        ],
        "insight_types": [
            {"type": "themes", "description": "Main themes and recurring ideas"},
            {"type": "sentiment", "description": "Emotional tone and sentiment"},
            {"type": "complexity", "description": "Content complexity analysis"},
            {"type": "topics", "description": "Subject areas and topics"}
        ]
    }
