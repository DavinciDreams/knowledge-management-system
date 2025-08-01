"""
Entity extraction API routes
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class EntityExtractionRequest(BaseModel):
    text: str
    include_calendar: bool = True
    entity_types: Optional[List[str]] = None


class CalendarEventRequest(BaseModel):
    text: str
    context: Optional[str] = None


class ActionItemRequest(BaseModel):
    text: str
    priority_threshold: Optional[float] = 0.5


@router.post("/extract")
async def extract_entities(request: Request, extraction_request: EntityExtractionRequest):
    """
    Extract entities from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        result = await entity_service.extract_entities(
            text=extraction_request.text,
            include_calendar=extraction_request.include_calendar
        )
        
        # Filter by entity types if specified
        if extraction_request.entity_types:
            filtered_entities = [
                entity for entity in result["entities"]
                if entity["type"] in extraction_request.entity_types
            ]
            result["entities"] = filtered_entities
            result["entity_counts"] = {
                entity_type: len([e for e in filtered_entities if e["type"] == entity_type])
                for entity_type in extraction_request.entity_types
            }
        
        return JSONResponse(content={
            "success": True,
            "extraction_result": result,
            "text_length": len(extraction_request.text)
        })
    
    except Exception as e:
        logger.error(f"Entity extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Entity extraction failed: {str(e)}")


@router.post("/calendar-events")
async def extract_calendar_events(request: Request, calendar_request: CalendarEventRequest):
    """
    Extract potential calendar events from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        # First extract entities
        extraction_result = await entity_service.extract_entities(
            text=calendar_request.text,
            include_calendar=True
        )
        
        calendar_events = extraction_result.get("calendar_events", [])
        
        return JSONResponse(content={
            "success": True,
            "calendar_events": calendar_events,
            "event_count": len(calendar_events),
            "text_length": len(calendar_request.text),
            "context": calendar_request.context
        })
    
    except Exception as e:
        logger.error(f"Calendar event extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Calendar event extraction failed: {str(e)}")


@router.post("/action-items")
async def extract_action_items(request: Request, action_request: ActionItemRequest):
    """
    Extract action items and tasks from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        action_items = await entity_service.extract_action_items(action_request.text)
        
        # Filter by priority threshold
        filtered_items = [
            item for item in action_items
            if item.get("confidence", 0) >= action_request.priority_threshold
        ]
        
        return JSONResponse(content={
            "success": True,
            "action_items": filtered_items,
            "total_found": len(action_items),
            "filtered_count": len(filtered_items),
            "priority_threshold": action_request.priority_threshold,
            "text_length": len(action_request.text)
        })
    
    except Exception as e:
        logger.error(f"Action item extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Action item extraction failed: {str(e)}")


@router.post("/people")
async def extract_people(request: Request, text: str):
    """
    Extract people/contacts from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        result = await entity_service.extract_entities(text, include_calendar=False)
        
        # Filter for people-related entities
        people_entities = [
            entity for entity in result["entities"]
            if entity["type"] in ["PERSON", "EMAIL", "PHONE"]
        ]
        
        # Group by person if possible
        contacts = {}
        for entity in people_entities:
            if entity["type"] == "PERSON":
                name = entity["value"]
                if name not in contacts:
                    contacts[name] = {
                        "name": name,
                        "emails": [],
                        "phones": [],
                        "confidence": entity["confidence"],
                        "context": entity["context"]
                    }
            elif entity["type"] == "EMAIL":
                # Try to associate with nearby person entities
                email = entity["value"]
                # Simple heuristic: find the closest person entity
                closest_person = None
                min_distance = float('inf')
                
                for person_entity in [e for e in people_entities if e["type"] == "PERSON"]:
                    distance = abs(entity["start_pos"] - person_entity["start_pos"])
                    if distance < min_distance:
                        min_distance = distance
                        closest_person = person_entity["value"]
                
                if closest_person and closest_person in contacts:
                    contacts[closest_person]["emails"].append(email)
                else:
                    # Create anonymous contact
                    anon_name = f"Contact ({email})"
                    contacts[anon_name] = {
                        "name": anon_name,
                        "emails": [email],
                        "phones": [],
                        "confidence": entity["confidence"],
                        "context": entity["context"]
                    }
        
        return JSONResponse(content={
            "success": True,
            "contacts": list(contacts.values()),
            "total_people_entities": len(people_entities),
            "text_length": len(text)
        })
    
    except Exception as e:
        logger.error(f"People extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"People extraction failed: {str(e)}")


@router.post("/locations")
async def extract_locations(request: Request, text: str):
    """
    Extract locations from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        result = await entity_service.extract_entities(text, include_calendar=False)
        
        # Filter for location entities
        location_entities = [
            entity for entity in result["entities"]
            if entity["type"] in ["GPE", "LOC", "FAC"]
        ]
        
        return JSONResponse(content={
            "success": True,
            "locations": location_entities,
            "location_count": len(location_entities),
            "text_length": len(text)
        })
    
    except Exception as e:
        logger.error(f"Location extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Location extraction failed: {str(e)}")


@router.post("/dates")
async def extract_dates(request: Request, text: str):
    """
    Extract dates and times from text
    """
    try:
        entity_service = request.app.state.entity
        
        if not entity_service:
            raise HTTPException(status_code=503, detail="Entity extraction service not available")
        
        result = await entity_service.extract_entities(text, include_calendar=False)
        
        # Filter for date/time entities
        temporal_entities = [
            entity for entity in result["entities"]
            if entity["type"] in ["DATE", "TIME"]
        ]
        
        return JSONResponse(content={
            "success": True,
            "temporal_entities": temporal_entities,
            "date_count": len([e for e in temporal_entities if e["type"] == "DATE"]),
            "time_count": len([e for e in temporal_entities if e["type"] == "TIME"]),
            "text_length": len(text)
        })
    
    except Exception as e:
        logger.error(f"Date extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Date extraction failed: {str(e)}")


@router.get("/entity-types")
async def get_supported_entity_types():
    """
    Get list of supported entity types
    """
    return {
        "entity_types": [
            {"type": "PERSON", "description": "People and names"},
            {"type": "ORG", "description": "Organizations and companies"},
            {"type": "GPE", "description": "Countries, cities, states"},
            {"type": "LOC", "description": "Locations and places"},
            {"type": "FAC", "description": "Facilities and buildings"},
            {"type": "DATE", "description": "Dates and date ranges"},
            {"type": "TIME", "description": "Times and time ranges"},
            {"type": "EMAIL", "description": "Email addresses"},
            {"type": "PHONE", "description": "Phone numbers"},
            {"type": "URL", "description": "Web URLs"},
            {"type": "MONEY", "description": "Monetary values"},
            {"type": "PERCENT", "description": "Percentages"},
            {"type": "CARDINAL", "description": "Numbers"},
            {"type": "ORDINAL", "description": "First, second, etc."}
        ]
    }
