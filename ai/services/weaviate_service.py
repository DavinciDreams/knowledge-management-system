import weaviate
from weaviate.classes.init import Auth
import json
from typing import Dict, List, Optional, Any
import logging
from config import settings

logger = logging.getLogger(__name__)


class WeaviateService:
    """Service for vector storage and semantic search using Weaviate"""
    
    def __init__(self):
        self.client = None
        self.collections = {}
        
    async def initialize(self):
        """Initialize Weaviate client and create schema"""
        try:
            # Connect to Weaviate
            auth = None
            if settings.weaviate_api_key:
                auth = Auth.api_key(settings.weaviate_api_key)
            
            self.client = weaviate.Client(
                url=settings.weaviate_url,
                auth=auth
            )
            
            # Verify connection
            if not self.client.is_ready():
                raise Exception("Weaviate is not ready")
            
            # Create schema if it doesn't exist
            await self._create_schema()
            
            logger.info("Weaviate service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Weaviate service: {e}")
            raise
    
    async def _create_schema(self):
        """Create Weaviate schema for knowledge management"""
        
        # Define collections (classes in Weaviate v3 terminology)
        collections_config = {
            "Document": {
                "description": "Knowledge base documents",
                "properties": [
                    {"name": "title", "dataType": ["text"]},
                    {"name": "content", "dataType": ["text"]},
                    {"name": "summary", "dataType": ["text"]},
                    {"name": "tags", "dataType": ["text[]"]},
                    {"name": "source", "dataType": ["text"]},
                    {"name": "sourceType", "dataType": ["text"]},
                    {"name": "createdAt", "dataType": ["date"]},
                    {"name": "modifiedAt", "dataType": ["date"]},
                    {"name": "userId", "dataType": ["text"]},
                    {"name": "entities", "dataType": ["text[]"]},
                    {"name": "metadata", "dataType": ["object"]},
                ],
                "vectorizer": "text2vec-transformers",
                "moduleConfig": {
                    "text2vec-transformers": {
                        "poolingStrategy": "masked_mean",
                        "vectorizeClassName": False
                    }
                }
            },
            
            "VoiceNote": {
                "description": "Voice recordings and transcriptions",
                "properties": [
                    {"name": "transcript", "dataType": ["text"]},
                    {"name": "audioUrl", "dataType": ["text"]},
                    {"name": "duration", "dataType": ["number"]},
                    {"name": "language", "dataType": ["text"]},
                    {"name": "confidence", "dataType": ["number"]},
                    {"name": "tags", "dataType": ["text[]"]},
                    {"name": "createdAt", "dataType": ["date"]},
                    {"name": "userId", "dataType": ["text"]},
                    {"name": "entities", "dataType": ["text[]"]},
                    {"name": "summary", "dataType": ["text"]},
                ],
                "vectorizer": "text2vec-transformers"
            },
            
            "CanvasElement": {
                "description": "Canvas drawings and sketches",
                "properties": [
                    {"name": "title", "dataType": ["text"]},
                    {"name": "description", "dataType": ["text"]},
                    {"name": "svgData", "dataType": ["text"]},
                    {"name": "canvasId", "dataType": ["text"]},
                    {"name": "position", "dataType": ["object"]},
                    {"name": "tags", "dataType": ["text[]"]},
                    {"name": "createdAt", "dataType": ["date"]},
                    {"name": "userId", "dataType": ["text"]},
                    {"name": "annotations", "dataType": ["text"]},
                ],
                "vectorizer": "text2vec-transformers"
            },
            
            "YouTubeVideo": {
                "description": "YouTube video metadata and transcripts",
                "properties": [
                    {"name": "title", "dataType": ["text"]},
                    {"name": "description", "dataType": ["text"]},
                    {"name": "transcript", "dataType": ["text"]},
                    {"name": "channel", "dataType": ["text"]},
                    {"name": "videoId", "dataType": ["text"]},
                    {"name": "duration", "dataType": ["number"]},
                    {"name": "publishedAt", "dataType": ["date"]},
                    {"name": "tags", "dataType": ["text[]"]},
                    {"name": "entities", "dataType": ["text[]"]},
                    {"name": "summary", "dataType": ["text"]},
                    {"name": "keyPoints", "dataType": ["text[]"]},
                    {"name": "userId", "dataType": ["text"]},
                ],
                "vectorizer": "text2vec-transformers"
            },
            
            "SocialPost": {
                "description": "Social media posts and content",
                "properties": [
                    {"name": "content", "dataType": ["text"]},
                    {"name": "platform", "dataType": ["text"]},
                    {"name": "author", "dataType": ["text"]},
                    {"name": "postId", "dataType": ["text"]},
                    {"name": "hashtags", "dataType": ["text[]"]},
                    {"name": "mentions", "dataType": ["text[]"]},
                    {"name": "urls", "dataType": ["text[]"]},
                    {"name": "createdAt", "dataType": ["date"]},
                    {"name": "entities", "dataType": ["text[]"]},
                    {"name": "sentiment", "dataType": ["text"]},
                    {"name": "userId", "dataType": ["text"]},
                ],
                "vectorizer": "text2vec-transformers"
            }
        }
        
        # Create collections
        for name, config in collections_config.items():
            try:
                collection = self.client.collections.get(name)
                logger.info(f"Collection {name} already exists")
                self.collections[name] = collection
            except Exception:
                # Collection doesn't exist, create it
                logger.info(f"Creating collection: {name}")
                collection = self.client.collections.create(
                    name=name,
                    description=config["description"],
                    properties=config["properties"],
                    vectorizer_config=weaviate.classes.config.Configure.Vectorizer.text2vec_transformers()
                )
                self.collections[name] = collection
    
    async def add_document(
        self,
        title: str,
        content: str,
        user_id: str,
        source: str = "manual",
        source_type: str = "document",
        tags: Optional[List[str]] = None,
        entities: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """Add a document to the knowledge base"""
        
        document_data = {
            "title": title,
            "content": content,
            "userId": user_id,
            "source": source,
            "sourceType": source_type,
            "tags": tags or [],
            "entities": entities or [],
            "metadata": metadata or {},
            "createdAt": "now",
            "modifiedAt": "now"
        }
        
        try:
            collection = self.collections.get("Document")
            if not collection:
                collection = self.client.collections.get("Document")
            
            uuid = collection.data.insert(document_data)
            logger.info(f"Document added with ID: {uuid}")
            return str(uuid)
            
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            raise
    
    async def add_voice_note(
        self,
        transcript: str,
        audio_url: str,
        user_id: str,
        duration: float,
        language: str = "en",
        confidence: float = 0.0,
        tags: Optional[List[str]] = None,
        entities: Optional[List[str]] = None,
        summary: Optional[str] = None
    ) -> str:
        """Add a voice note to the knowledge base"""
        
        voice_data = {
            "transcript": transcript,
            "audioUrl": audio_url,
            "userId": user_id,
            "duration": duration,
            "language": language,
            "confidence": confidence,
            "tags": tags or [],
            "entities": entities or [],
            "summary": summary or "",
            "createdAt": "now"
        }
        
        try:
            collection = self.collections.get("VoiceNote")
            if not collection:
                collection = self.client.collections.get("VoiceNote")
            
            uuid = collection.data.insert(voice_data)
            logger.info(f"Voice note added with ID: {uuid}")
            return str(uuid)
            
        except Exception as e:
            logger.error(f"Failed to add voice note: {e}")
            raise
    
    async def add_youtube_video(
        self,
        title: str,
        description: str,
        video_id: str,
        channel: str,
        user_id: str,
        transcript: Optional[str] = None,
        duration: Optional[float] = None,
        tags: Optional[List[str]] = None,
        entities: Optional[List[str]] = None,
        summary: Optional[str] = None,
        key_points: Optional[List[str]] = None
    ) -> str:
        """Add YouTube video data to the knowledge base"""
        
        video_data = {
            "title": title,
            "description": description,
            "videoId": video_id,
            "channel": channel,
            "userId": user_id,
            "transcript": transcript or "",
            "duration": duration or 0,
            "tags": tags or [],
            "entities": entities or [],
            "summary": summary or "",
            "keyPoints": key_points or [],
            "publishedAt": "now"
        }
        
        try:
            collection = self.collections.get("YouTubeVideo")
            if not collection:
                collection = self.client.collections.get("YouTubeVideo")
            
            uuid = collection.data.insert(video_data)
            logger.info(f"YouTube video added with ID: {uuid}")
            return str(uuid)
            
        except Exception as e:
            logger.error(f"Failed to add YouTube video: {e}")
            raise
    
    async def semantic_search(
        self,
        query: str,
        collection_names: Optional[List[str]] = None,
        limit: int = 10,
        user_id: Optional[str] = None,
        min_certainty: float = 0.7
    ) -> List[Dict]:
        """Perform semantic search across collections"""
        
        if not collection_names:
            collection_names = ["Document", "VoiceNote", "YouTubeVideo", "SocialPost"]
        
        all_results = []
        
        for collection_name in collection_names:
            try:
                collection = self.collections.get(collection_name)
                if not collection:
                    collection = self.client.collections.get(collection_name)
                
                # Build query
                where_filter = None
                if user_id:
                    where_filter = weaviate.classes.query.Filter.by_property("userId").equal(user_id)
                
                # Perform search
                response = collection.query.near_text(
                    query=query,
                    limit=limit,
                    where=where_filter,
                    certainty=min_certainty,
                    return_metadata=weaviate.classes.query.MetadataQuery(certainty=True)
                )
                
                # Process results
                for obj in response.objects:
                    result = {
                        "id": str(obj.uuid),
                        "collection": collection_name,
                        "properties": obj.properties,
                        "certainty": obj.metadata.certainty,
                        "score": obj.metadata.certainty  # Alias for compatibility
                    }
                    all_results.append(result)
                    
            except Exception as e:
                logger.error(f"Search error in collection {collection_name}: {e}")
                continue
        
        # Sort by certainty/score
        all_results.sort(key=lambda x: x["certainty"], reverse=True)
        
        return all_results[:limit]
    
    async def get_similar_documents(
        self,
        document_id: str,
        collection_name: str = "Document",
        limit: int = 5,
        user_id: Optional[str] = None
    ) -> List[Dict]:
        """Find documents similar to a given document"""
        
        try:
            collection = self.collections.get(collection_name)
            if not collection:
                collection = self.client.collections.get(collection_name)
            
            # Get the source document
            source_doc = collection.query.fetch_object_by_id(document_id)
            if not source_doc:
                raise ValueError(f"Document {document_id} not found")
            
            # Use the document's content for similarity search
            content = source_doc.properties.get("content", "")
            if not content:
                content = source_doc.properties.get("title", "")
            
            # Perform similarity search
            where_filter = None
            if user_id:
                where_filter = weaviate.classes.query.Filter.by_property("userId").equal(user_id)
            
            response = collection.query.near_text(
                query=content,
                limit=limit + 1,  # +1 to exclude the source document
                where=where_filter,
                return_metadata=weaviate.classes.query.MetadataQuery(certainty=True)
            )
            
            # Filter out the source document
            results = []
            for obj in response.objects:
                if str(obj.uuid) != document_id:
                    result = {
                        "id": str(obj.uuid),
                        "properties": obj.properties,
                        "certainty": obj.metadata.certainty
                    }
                    results.append(result)
            
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Failed to find similar documents: {e}")
            raise
    
    async def get_document_by_id(self, document_id: str, collection_name: str = "Document") -> Optional[Dict]:
        """Retrieve a document by ID"""
        
        try:
            collection = self.collections.get(collection_name)
            if not collection:
                collection = self.client.collections.get(collection_name)
            
            obj = collection.query.fetch_object_by_id(document_id)
            if obj:
                return {
                    "id": str(obj.uuid),
                    "properties": obj.properties
                }
            return None
            
        except Exception as e:
            logger.error(f"Failed to get document {document_id}: {e}")
            return None
    
    async def delete_document(self, document_id: str, collection_name: str = "Document") -> bool:
        """Delete a document"""
        
        try:
            collection = self.collections.get(collection_name)
            if not collection:
                collection = self.client.collections.get(collection_name)
            
            collection.data.delete_by_id(document_id)
            logger.info(f"Document {document_id} deleted")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            return False
    
    async def update_document(
        self,
        document_id: str,
        updates: Dict,
        collection_name: str = "Document"
    ) -> bool:
        """Update a document"""
        
        try:
            collection = self.collections.get(collection_name)
            if not collection:
                collection = self.client.collections.get(collection_name)
            
            # Add modification timestamp
            updates["modifiedAt"] = "now"
            
            collection.data.update(
                uuid=document_id,
                properties=updates
            )
            
            logger.info(f"Document {document_id} updated")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update document {document_id}: {e}")
            return False
    
    async def get_user_documents(
        self,
        user_id: str,
        collection_name: str = "Document",
        limit: int = 100
    ) -> List[Dict]:
        """Get all documents for a user"""
        
        try:
            collection = self.collections.get(collection_name)
            if not collection:
                collection = self.client.collections.get(collection_name)
            
            where_filter = weaviate.classes.query.Filter.by_property("userId").equal(user_id)
            
            response = collection.query.fetch_objects(
                where=where_filter,
                limit=limit
            )
            
            results = []
            for obj in response.objects:
                result = {
                    "id": str(obj.uuid),
                    "properties": obj.properties
                }
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get user documents: {e}")
            return []
    
    async def health_check(self) -> bool:
        """Check if Weaviate is healthy"""
        try:
            return self.client.is_ready() if self.client else False
        except Exception:
            return False
    
    async def close(self):
        """Close the Weaviate connection"""
        if self.client:
            self.client.close()
            logger.info("Weaviate connection closed")
