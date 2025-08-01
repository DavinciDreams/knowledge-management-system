"""
Entity extraction service for calendar integration and content analysis
"""

import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import dateutil.parser
from dateutil.relativedelta import relativedelta
import spacy
from dataclasses import dataclass
import phonenumbers
from email_validator import validate_email, EmailNotValidError

logger = logging.getLogger(__name__)


@dataclass
class ExtractedEntity:
    """Represents an extracted entity with metadata"""
    type: str
    value: str
    confidence: float
    context: str
    start_pos: int
    end_pos: int
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class CalendarEvent:
    """Represents a potential calendar event"""
    title: str
    description: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    location: Optional[str]
    attendees: List[str]
    confidence: float
    source_text: str
    entities: List[ExtractedEntity]


class EntityExtractionService:
    """Service for extracting entities and calendar events from text"""
    
    def __init__(self, ner_service):
        self.ner_service = ner_service
        self.nlp = None
        
        # Date/time patterns
        self.date_patterns = [
            r'\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
            r'\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b',
            r'\b\d{1,2}\/\d{1,2}\/\d{2,4}\b',
            r'\b\d{1,2}-\d{1,2}-\d{2,4}\b',
            r'\btomorrow\b',
            r'\byesterday\b',
            r'\bnext\s+(?:week|month|year)\b',
            r'\bin\s+\d+\s+(?:days?|weeks?|months?)\b'
        ]
        
        self.time_patterns = [
            r'\b\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?\b',
            r'\b\d{1,2}\s*(?:am|pm|AM|PM)\b',
            r'\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\b',
            r'\b(?:morning|afternoon|evening|night)\b',
            r'\bnoon\b',
            r'\bmidnight\b'
        ]
        
        # Event indicators
        self.event_keywords = [
            'meeting', 'appointment', 'call', 'conference', 'lunch', 'dinner',
            'presentation', 'interview', 'workshop', 'seminar', 'training',
            'deadline', 'due', 'reminder', 'event', 'party', 'celebration',
            'birthday', 'anniversary', 'vacation', 'trip', 'flight', 'travel'
        ]
    
    async def initialize(self):
        """Initialize the entity extraction service"""
        try:
            # Load spaCy model for additional processing
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("Entity extraction service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize entity extraction service: {e}")
            raise
    
    async def extract_entities(self, text: str, include_calendar: bool = True) -> Dict[str, Any]:
        """Extract all entities from text"""
        if not text.strip():
            return {"entities": [], "calendar_events": []}
        
        # Use NER service for basic entity extraction
        ner_results = await self.ner_service.extract_entities(text)
        
        # Extract additional entities
        entities = []
        
        # Process NER results
        for entity in ner_results.get("entities", []):
            entities.append(ExtractedEntity(
                type=entity["label"],
                value=entity["text"],
                confidence=entity["confidence"],
                context=text[max(0, entity["start"]-50):entity["end"]+50],
                start_pos=entity["start"],
                end_pos=entity["end"],
                metadata={"source": "ner"}
            ))
        
        # Extract emails
        email_entities = self._extract_emails(text)
        entities.extend(email_entities)
        
        # Extract phone numbers
        phone_entities = self._extract_phone_numbers(text)
        entities.extend(phone_entities)
        
        # Extract URLs
        url_entities = self._extract_urls(text)
        entities.extend(url_entities)
        
        # Extract dates and times
        date_entities = self._extract_dates(text)
        entities.extend(date_entities)
        
        time_entities = self._extract_times(text)
        entities.extend(time_entities)
        
        result = {
            "entities": [entity.__dict__ for entity in entities],
            "entity_counts": self._count_entities(entities),
            "text_length": len(text),
            "word_count": len(text.split())
        }
        
        # Extract calendar events if requested
        if include_calendar:
            calendar_events = await self._extract_calendar_events(text, entities)
            result["calendar_events"] = [event.__dict__ for event in calendar_events]
        
        return result
    
    def _extract_emails(self, text: str) -> List[ExtractedEntity]:
        """Extract email addresses from text"""
        entities = []
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        
        for match in re.finditer(email_pattern, text):
            email = match.group()
            try:
                # Validate email
                validation = validate_email(email)
                entities.append(ExtractedEntity(
                    type="EMAIL",
                    value=validation.email,
                    confidence=0.9,
                    context=text[max(0, match.start()-30):match.end()+30],
                    start_pos=match.start(),
                    end_pos=match.end(),
                    metadata={"validated": True}
                ))
            except EmailNotValidError:
                # Still include invalid emails with lower confidence
                entities.append(ExtractedEntity(
                    type="EMAIL",
                    value=email,
                    confidence=0.5,
                    context=text[max(0, match.start()-30):match.end()+30],
                    start_pos=match.start(),
                    end_pos=match.end(),
                    metadata={"validated": False}
                ))
        
        return entities
    
    def _extract_phone_numbers(self, text: str) -> List[ExtractedEntity]:
        """Extract phone numbers from text"""
        entities = []
        
        # Common phone number patterns
        patterns = [
            r'\b\d{3}-\d{3}-\d{4}\b',  # 123-456-7890
            r'\b\(\d{3}\)\s*\d{3}-\d{4}\b',  # (123) 456-7890
            r'\b\d{3}\.\d{3}\.\d{4}\b',  # 123.456.7890
            r'\b\d{10}\b',  # 1234567890
            r'\b\+1\s*\d{3}\s*\d{3}\s*\d{4}\b'  # +1 123 456 7890
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                phone = match.group()
                
                # Try to parse and validate with phonenumbers library
                try:
                    parsed = phonenumbers.parse(phone, "US")
                    if phonenumbers.is_valid_number(parsed):
                        formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)
                        entities.append(ExtractedEntity(
                            type="PHONE",
                            value=formatted,
                            confidence=0.9,
                            context=text[max(0, match.start()-30):match.end()+30],
                            start_pos=match.start(),
                            end_pos=match.end(),
                            metadata={"validated": True, "original": phone}
                        ))
                except:
                    # Include unvalidated numbers with lower confidence
                    entities.append(ExtractedEntity(
                        type="PHONE",
                        value=phone,
                        confidence=0.6,
                        context=text[max(0, match.start()-30):match.end()+30],
                        start_pos=match.start(),
                        end_pos=match.end(),
                        metadata={"validated": False}
                    ))
        
        return entities
    
    def _extract_urls(self, text: str) -> List[ExtractedEntity]:
        """Extract URLs from text"""
        entities = []
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+'
        
        for match in re.finditer(url_pattern, text):
            url = match.group()
            entities.append(ExtractedEntity(
                type="URL",
                value=url,
                confidence=0.8,
                context=text[max(0, match.start()-30):match.end()+30],
                start_pos=match.start(),
                end_pos=match.end()
            ))
        
        return entities
    
    def _extract_dates(self, text: str) -> List[ExtractedEntity]:
        """Extract dates from text"""
        entities = []
        
        for pattern in self.date_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                date_text = match.group()
                
                # Try to parse the date
                parsed_date = self._parse_date(date_text)
                if parsed_date:
                    entities.append(ExtractedEntity(
                        type="DATE",
                        value=date_text,
                        confidence=0.8,
                        context=text[max(0, match.start()-30):match.end()+30],
                        start_pos=match.start(),
                        end_pos=match.end(),
                        metadata={"parsed_date": parsed_date.isoformat()}
                    ))
        
        return entities
    
    def _extract_times(self, text: str) -> List[ExtractedEntity]:
        """Extract times from text"""
        entities = []
        
        for pattern in self.time_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                time_text = match.group()
                entities.append(ExtractedEntity(
                    type="TIME",
                    value=time_text,
                    confidence=0.7,
                    context=text[max(0, match.start()-30):match.end()+30],
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return entities
    
    def _parse_date(self, date_text: str) -> Optional[datetime]:
        """Parse a date string into a datetime object"""
        try:
            # Handle relative dates
            today = datetime.now()
            
            if "tomorrow" in date_text.lower():
                return today + timedelta(days=1)
            elif "yesterday" in date_text.lower():
                return today - timedelta(days=1)
            elif "next week" in date_text.lower():
                return today + timedelta(weeks=1)
            elif "next month" in date_text.lower():
                return today + relativedelta(months=1)
            elif "next year" in date_text.lower():
                return today + relativedelta(years=1)
            
            # Handle weekdays
            weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for i, day in enumerate(weekdays):
                if day in date_text.lower():
                    days_ahead = i - today.weekday()
                    if days_ahead <= 0:  # Target day already happened this week
                        days_ahead += 7
                    return today + timedelta(days=days_ahead)
            
            # Try parsing with dateutil
            return dateutil.parser.parse(date_text, fuzzy=True)
            
        except:
            return None
    
    async def _extract_calendar_events(self, text: str, entities: List[ExtractedEntity]) -> List[CalendarEvent]:
        """Extract potential calendar events from text and entities"""
        events = []
        
        # Look for event indicators
        sentences = text.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Check if sentence contains event keywords
            has_event_keyword = any(keyword in sentence.lower() for keyword in self.event_keywords)
            
            # Check if sentence contains date/time entities
            sentence_entities = [e for e in entities if e.context in sentence or sentence in e.context]
            date_entities = [e for e in sentence_entities if e.type == "DATE"]
            time_entities = [e for e in sentence_entities if e.type == "TIME"]
            person_entities = [e for e in sentence_entities if e.type in ["PERSON", "ORG"]]
            location_entities = [e for e in sentence_entities if e.type in ["GPE", "LOC", "FAC"]]
            
            if has_event_keyword and (date_entities or time_entities):
                # Extract event details
                title = self._extract_event_title(sentence)
                start_time = self._combine_date_time(date_entities, time_entities)
                
                event = CalendarEvent(
                    title=title,
                    description=sentence,
                    start_time=start_time,
                    end_time=None,  # Could be enhanced to detect duration
                    location=location_entities[0].value if location_entities else None,
                    attendees=[e.value for e in person_entities],
                    confidence=0.7 if has_event_keyword and date_entities and time_entities else 0.5,
                    source_text=sentence,
                    entities=sentence_entities
                )
                
                events.append(event)
        
        return events
    
    def _extract_event_title(self, sentence: str) -> str:
        """Extract a title for the event from the sentence"""
        # Simple approach: use the sentence up to the first event keyword
        for keyword in self.event_keywords:
            if keyword in sentence.lower():
                parts = sentence.lower().split(keyword)
                if len(parts) > 1:
                    return f"{keyword.title()} {parts[1].strip()[:50]}"
                else:
                    return f"{keyword.title()}"
        
        # Fallback: use first 50 characters
        return sentence[:50].strip()
    
    def _combine_date_time(self, date_entities: List[ExtractedEntity], time_entities: List[ExtractedEntity]) -> Optional[datetime]:
        """Combine date and time entities into a datetime object"""
        if not date_entities:
            return None
        
        # Use first date entity
        date_entity = date_entities[0]
        parsed_date = None
        
        if date_entity.metadata and "parsed_date" in date_entity.metadata:
            try:
                parsed_date = datetime.fromisoformat(date_entity.metadata["parsed_date"])
            except:
                pass
        
        if not parsed_date:
            parsed_date = self._parse_date(date_entity.value)
        
        if not parsed_date:
            return None
        
        # If we have time entities, try to combine them
        if time_entities:
            time_entity = time_entities[0]
            try:
                # Parse time and combine with date
                time_str = time_entity.value
                time_obj = dateutil.parser.parse(time_str, fuzzy=True).time()
                return datetime.combine(parsed_date.date(), time_obj)
            except:
                pass
        
        return parsed_date
    
    def _count_entities(self, entities: List[ExtractedEntity]) -> Dict[str, int]:
        """Count entities by type"""
        counts = {}
        for entity in entities:
            counts[entity.type] = counts.get(entity.type, 0) + 1
        return counts
    
    async def extract_action_items(self, text: str) -> List[Dict[str, Any]]:
        """Extract action items and tasks from text"""
        action_items = []
        
        # Action patterns
        action_patterns = [
            r'\b(?:need to|should|must|have to|remember to|don\'t forget to)\s+([^.!?]+)',
            r'\b(?:todo|to do|task|action item):\s*([^.!?]+)',
            r'\b(?:follow up|reach out|contact|call|email)\s+([^.!?]+)',
            r'\b(?:schedule|book|set up|arrange)\s+([^.!?]+)',
            r'\b(?:review|check|verify|confirm)\s+([^.!?]+)'
        ]
        
        for pattern in action_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                action_text = match.group(1).strip()
                if action_text:
                    action_items.append({
                        "text": action_text,
                        "full_context": match.group(0),
                        "confidence": 0.8,
                        "type": "action_item",
                        "extracted_at": datetime.now().isoformat()
                    })
        
        return action_items
