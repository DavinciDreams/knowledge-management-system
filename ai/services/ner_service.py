import spacy
from spacy import displacy
from spacy.cli.download import download as spacy_download
from spacy.explain import explain
from transformers.pipelines import pipeline
import re
from typing import Dict, List, Optional, Tuple
import logging
from config import settings

logger = logging.getLogger(__name__)


class NERService:
    """Named Entity Recognition service using spaCy and Hugging Face transformers"""
    
    def __init__(self):
        self.spacy_nlp = None
        self.hf_ner = None
        
    async def initialize(self):
        """Initialize NER models"""
        try:
            # Load spaCy model
            logger.info("Loading spaCy NER model...")
            try:
                self.spacy_nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("spaCy en_core_web_sm not found, downloading...")
                spacy_download("en_core_web_sm")
                self.spacy_nlp = spacy.load("en_core_web_sm")
            
            # Load Hugging Face NER model
            logger.info("Loading Hugging Face NER model...")
            self.hf_ner = pipeline(
                "ner",
                model=settings.ner_model,
                tokenizer=settings.ner_model,
                aggregation_strategy="simple"
            )
            
            logger.info("NER service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize NER service: {e}")
            raise
    
    async def extract_entities(
        self,
        text: str,
        use_spacy: bool = True,
        use_huggingface: bool = True,
        confidence_threshold: float = 0.5
    ) -> Dict:
        """
        Extract named entities from text using multiple models
        
        Args:
            text: Input text
            use_spacy: Use spaCy model
            use_huggingface: Use Hugging Face model
            confidence_threshold: Minimum confidence for HF entities
            
        Returns:
            Combined entity extraction results
        """
        entities = {
            "spacy_entities": [],
            "hf_entities": [],
            "merged_entities": [],
            "entity_counts": {},
            "text_length": len(text)
        }
        
        # Extract with spaCy
        if use_spacy and self.spacy_nlp:
            entities["spacy_entities"] = await self._extract_spacy_entities(text)
        
        # Extract with Hugging Face
        if use_huggingface and self.hf_ner:
            entities["hf_entities"] = await self._extract_hf_entities(text, confidence_threshold)
        
        # Merge and deduplicate entities
        entities["merged_entities"] = self._merge_entities(
            entities["spacy_entities"],
            entities["hf_entities"]
        )
        
        # Count entities by type
        entities["entity_counts"] = self._count_entities(entities["merged_entities"])
        
        return entities
    
    async def _extract_spacy_entities(self, text: str) -> List[Dict]:
        """Extract entities using spaCy"""
        if not self.spacy_nlp:
            raise RuntimeError("spaCy model is not loaded. Please call 'await initialize()' before extracting entities.")
        doc = self.spacy_nlp(text)
        entities = []
        
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
                "description": explain(ent.label_),
                "source": "spacy"
            })
        
        return entities
    
    async def _extract_hf_entities(self, text: str, threshold: float) -> List[Dict]:
        """Extract entities using Hugging Face"""
        if not self.hf_ner:
            raise RuntimeError("Hugging Face NER pipeline is not loaded. Please call 'await initialize()' before extracting entities.")
        results = self.hf_ner(text)
        entities = []
        
        for entity in results:
            if entity is not None and entity.get("score", 0) >= threshold:
                entities.append({
                    "text": entity.get("word", ""),
                    "label": entity.get("entity_group", ""),
                    "start": entity.get("start", 0),
                    "end": entity.get("end", 0),
                    "confidence": entity.get("score", 0),
                    "source": "huggingface"
                })
        
        return entities
    
    def _merge_entities(self, spacy_entities: List[Dict], hf_entities: List[Dict]) -> List[Dict]:
        """Merge entities from different sources, removing duplicates"""
        merged = []
        seen_spans = set()
        
        # Add all entities and track overlaps
        all_entities = spacy_entities + hf_entities
        
        # Sort by start position
        all_entities.sort(key=lambda x: x["start"])
        
        for entity in all_entities:
            span = (entity["start"], entity["end"])
            
            # Check for overlaps
            overlapping = False
            for seen_span in seen_spans:
                if self._spans_overlap(span, seen_span):
                    overlapping = True
                    break
            
            if not overlapping:
                merged.append(entity)
                seen_spans.add(span)
        
        return merged
    
    def _spans_overlap(self, span1: Tuple[int, int], span2: Tuple[int, int]) -> bool:
        """Check if two spans overlap"""
        return span1[0] < span2[1] and span2[0] < span1[1]
    
    def _count_entities(self, entities: List[Dict]) -> Dict[str, int]:
        """Count entities by type"""
        counts = {}
        for entity in entities:
            label = entity["label"]
            counts[label] = counts.get(label, 0) + 1
        return counts
    
    async def extract_calendar_entities(self, text: str) -> Dict:
        """
        Extract entities specifically useful for calendar events
        
        Returns:
            Dictionary with dates, times, people, locations, phone numbers
        """
        entities = await self.extract_entities(text)
        
        calendar_entities = {
            "dates": [],
            "times": [],
            "people": [],
            "locations": [],
            "organizations": [],
            "phone_numbers": [],
            "emails": [],
            "events": []
        }
        
        # Process merged entities
        for entity in entities["merged_entities"]:
            label = entity["label"]
            text = entity["text"]
            
            if label in ["DATE", "TIME"]:
                calendar_entities["dates"].append(entity)
            elif label in ["PERSON", "PER"]:
                calendar_entities["people"].append(entity)
            elif label in ["GPE", "LOC", "LOCATION"]:
                calendar_entities["locations"].append(entity)
            elif label in ["ORG", "ORGANIZATION"]:
                calendar_entities["organizations"].append(entity)
        
        # Extract additional patterns
        calendar_entities.update(await self._extract_contact_info(text))
        calendar_entities.update(await self._extract_time_expressions(text))
        
        return calendar_entities
    
    async def _extract_contact_info(self, text: str) -> Dict:
        """Extract phone numbers and emails using regex"""
        
        # Phone number patterns
        phone_patterns = [
            r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # 123-456-7890, 123.456.7890
            r'\(\d{3}\)\s*\d{3}[-.]?\d{4}',    # (123) 456-7890
            r'\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',  # +1-123-456-7890
        ]
        
        # Email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        
        phone_numbers = []
        for pattern in phone_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                phone_numbers.append({
                    "text": match.group(),
                    "start": match.start(),
                    "end": match.end(),
                    "label": "PHONE",
                    "confidence": 0.9,
                    "source": "regex"
                })
        
        emails = []
        email_matches = re.finditer(email_pattern, text)
        for match in email_matches:
            emails.append({
                "text": match.group(),
                "start": match.start(),
                "end": match.end(),
                "label": "EMAIL",
                "confidence": 0.9,
                "source": "regex"
            })
        
        return {
            "phone_numbers": phone_numbers,
            "emails": emails
        }
    
    async def _extract_time_expressions(self, text: str) -> Dict:
        """Extract time expressions using patterns"""
        
        time_patterns = [
            r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b',  # 2:30 PM, 14:30
            r'\b(?:at|@)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b',  # at 3pm
            r'\b\d{1,2}\s*(?:AM|PM|am|pm)\b',  # 3PM
        ]
        
        times = []
        for pattern in time_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                times.append({
                    "text": match.group().strip(),
                    "start": match.start(),
                    "end": match.end(),
                    "label": "TIME",
                    "confidence": 0.8,
                    "source": "regex"
                })
        
        return {"times": times}
    
    async def extract_youtube_entities(self, metadata: Dict, transcript: str = "") -> Dict:
        """Extract entities from YouTube video metadata and transcript"""
        
        combined_text = f"""
        Title: {metadata.get('title', '')}
        Description: {metadata.get('description', '')}
        Channel: {metadata.get('channel', '')}
        Tags: {', '.join(metadata.get('tags', []))}
        Transcript: {transcript[:1000]}  # First 1000 chars
        """
        
        entities = await self.extract_entities(combined_text)
        
        # Categorize entities by source
        youtube_entities = {
            "title_entities": [],
            "description_entities": [],
            "transcript_entities": [],
            "all_entities": entities["merged_entities"],
            "people_mentioned": [],
            "topics_covered": [],
            "organizations": []
        }
        
        # Extract people, topics, and organizations
        for entity in entities["merged_entities"]:
            if entity["label"] in ["PERSON", "PER"]:
                youtube_entities["people_mentioned"].append(entity["text"])
            elif entity["label"] in ["ORG", "ORGANIZATION"]:
                youtube_entities["organizations"].append(entity["text"])
            elif entity["label"] in ["MISC", "PRODUCT", "EVENT"]:
                youtube_entities["topics_covered"].append(entity["text"])
        
        return youtube_entities
    
    async def extract_social_media_entities(self, post_data: Dict) -> Dict:
        """Extract entities from social media posts (tweets, etc.)"""
        
        text = post_data.get("text", "")
        if not text:
            return {"entities": [], "hashtags": [], "mentions": []}
        
        entities = await self.extract_entities(text)
        
        # Extract hashtags and mentions
        hashtags = re.findall(r'#\w+', text)
        mentions = re.findall(r'@\w+', text)
        
        # Extract URLs
        urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', text)
        
        return {
            "entities": entities["merged_entities"],
            "hashtags": [tag[1:] for tag in hashtags],  # Remove #
            "mentions": [mention[1:] for mention in mentions],  # Remove @
            "urls": urls,
            "sentiment_entities": await self._extract_sentiment_entities(text)
        }
    
    async def _extract_sentiment_entities(self, text: str) -> List[Dict]:
        """Extract entities that might indicate sentiment"""
        # This is a simplified version - in production, you'd use a sentiment model
        positive_words = ["great", "excellent", "amazing", "wonderful", "fantastic"]
        negative_words = ["bad", "terrible", "awful", "horrible", "disappointing"]
        
        sentiment_entities = []
        
        for word in positive_words:
            if word.lower() in text.lower():
                sentiment_entities.append({
                    "text": word,
                    "sentiment": "positive",
                    "confidence": 0.7
                })
        
        for word in negative_words:
            if word.lower() in text.lower():
                sentiment_entities.append({
                    "text": word,
                    "sentiment": "negative",
                    "confidence": 0.7
                })
        
        return sentiment_entities
    
    def get_entity_visualization(self, text: str, entities: List[Dict]) -> str:
        """Generate HTML visualization of entities"""
        if not self.spacy_nlp:
            return "spaCy not available for visualization"
        
        # Create a spaCy doc with entities
        doc = self.spacy_nlp(text)
        
        # Convert our entities back to spaCy format
        ents = []
        for entity in entities:
            span = doc.char_span(entity["start"], entity["end"], label=entity["label"])
            if span:
                ents.append(span)
        
        doc.ents = ents
        
        # Generate HTML
        html = displacy.render(doc, style="ent", page=True)
        return html
