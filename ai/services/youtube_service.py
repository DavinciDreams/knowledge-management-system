"""
YouTube service for extracting video metadata, transcripts, and processing content
"""

import logging
import re
from typing import Dict, List, Optional, Any
from datetime import datetime
import aiohttp
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api._api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
import googleapiclient.discovery
from googleapiclient.errors import HttpError

from config import settings

logger = logging.getLogger(__name__)


class YouTubeService:
    """Service for YouTube video processing and transcript extraction"""
    
    def __init__(self):
        self.api_key = settings.youtube_api_key
        self.youtube_api = None
        if self.api_key:
            self.youtube_api = googleapiclient.discovery.build(
                "youtube", "v3", developerKey=self.api_key
            )
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/v\/([^&\n?#]+)',
            r'youtube\.com\/embed\/([^&\n?#]+)',
            r'youtu\.be\/([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    async def get_video_metadata(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video metadata using YouTube API"""
        if not self.youtube_api:
            logger.warning("YouTube API not configured, using basic metadata")
            return {
                "id": video_id,
                "title": f"YouTube Video {video_id}",
                "description": "",
                "channel_title": "Unknown",
                "published_at": datetime.now().isoformat(),
                "duration": "Unknown",
                "view_count": 0,
                "like_count": 0,
                "tags": []
            }
        
        try:
            request = self.youtube_api.videos().list(
                part="snippet,statistics,contentDetails",
                id=video_id
            )
            response = request.execute()
            
            if not response.get("items"):
                return None
            
            video = response["items"][0]
            snippet = video["snippet"]
            statistics = video.get("statistics", {})
            content_details = video.get("contentDetails", {})
            
            return {
                "id": video_id,
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "channel_title": snippet.get("channelTitle", ""),
                "published_at": snippet.get("publishedAt", ""),
                "duration": content_details.get("duration", ""),
                "view_count": int(statistics.get("viewCount", 0)),
                "like_count": int(statistics.get("likeCount", 0)),
                "tags": snippet.get("tags", []),
                "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", "")
            }
            
        except HttpError as e:
            logger.error(f"YouTube API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting video metadata: {e}")
            return None
    
    async def get_transcript(self, video_id: str, languages: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        """Get video transcript with timestamps"""
        if languages is None:
            languages = ['en', 'en-US', 'en-GB']
        
        try:
            # Try to get transcript in preferred languages
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            transcript = None
            used_language = None
            
            # Try manual transcripts first
            for lang in languages:
                try:
                    transcript = transcript_list.find_manually_created_transcript([lang])
                    used_language = lang
                    break
                except:
                    continue
            
            # Fall back to auto-generated if no manual transcript found
            if not transcript:
                for lang in languages:
                    try:
                        transcript = transcript_list.find_generated_transcript([lang])
                        used_language = lang
                        break
                    except:
                        continue
            
            if not transcript:
                # Try any available transcript
                available_transcripts = list(transcript_list)
                if available_transcripts:
                    transcript = available_transcripts[0]
                    used_language = transcript.language_code
            
            if not transcript:
                return None
            
            # Fetch transcript data
            transcript_data = transcript.fetch()
            
            # Format transcript with timestamps
            segments = []
            full_text = ""
            
            for entry in transcript_data:
                segments.append({
                    "start": entry.start,
                    "duration": entry.duration,
                    "text": entry.text
                })
                full_text += entry.text + " "
            
            return {
                "language": used_language,
                "is_generated": transcript.is_generated,
                "segments": segments,
                "full_text": full_text.strip(),
                "word_count": len(full_text.split())
            }
            
        except Exception as e:
            logger.error(f"Error getting transcript for video {video_id}: {e}")
            return None
    
    async def process_video(self, url: str) -> Optional[Dict[str, Any]]:
        """Process a YouTube video and extract all available information"""
        video_id = self.extract_video_id(url)
        if not video_id:
            return None
        
        try:
            # Get metadata and transcript in parallel
            metadata = await self.get_video_metadata(video_id)
            transcript = await self.get_transcript(video_id)
            
            if not metadata:
                return None
            
            result = {
                **metadata,
                "url": url,
                "transcript": transcript,
                "processed_at": datetime.now().isoformat(),
                "has_transcript": transcript is not None
            }
            
            # Add content analysis if transcript is available
            if transcript:
                result["content_analysis"] = {
                    "language": transcript["language"],
                    "duration_minutes": len(transcript["segments"]) * 0.1,  # Rough estimate
                    "word_count": transcript["word_count"],
                    "has_auto_captions": transcript["is_generated"]
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing YouTube video {url}: {e}")
            return None
    
    async def extract_key_moments(self, transcript_segments: List[Dict]) -> List[Dict[str, Any]]:
        """Extract key moments from transcript segments"""
        key_moments = []
        
        # Simple keyword-based approach for finding important moments
        important_keywords = [
            "conclusion", "summary", "important", "key point", "main idea",
            "remember", "takeaway", "lesson", "insight", "breakthrough"
        ]
        
        for i, segment in enumerate(transcript_segments):
            text_lower = segment["text"].lower()
            
            # Check for important keywords
            for keyword in important_keywords:
                if keyword in text_lower:
                    key_moments.append({
                        "timestamp": segment["start"],
                        "text": segment["text"],
                        "reason": f"Contains keyword: {keyword}",
                        "confidence": 0.7
                    })
                    break
            
            # Check for question patterns
            if "?" in segment["text"]:
                key_moments.append({
                    "timestamp": segment["start"],
                    "text": segment["text"],
                    "reason": "Question or discussion point",
                    "confidence": 0.5
                })
            
            # Check for enumeration (numbered lists)
            if re.search(r'\b(first|second|third|1\.|2\.|3\.)', text_lower):
                key_moments.append({
                    "timestamp": segment["start"],
                    "text": segment["text"],
                    "reason": "Enumerated point",
                    "confidence": 0.6
                })
        
        # Remove duplicates and sort by timestamp
        unique_moments = []
        seen_timestamps = set()
        
        for moment in sorted(key_moments, key=lambda x: x["timestamp"]):
            if moment["timestamp"] not in seen_timestamps:
                unique_moments.append(moment)
                seen_timestamps.add(moment["timestamp"])
        
        return unique_moments[:10]  # Return top 10 moments
    
    def format_timestamp(self, seconds: float) -> str:
        """Format timestamp for YouTube URL"""
        total_seconds = int(seconds)
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        if hours > 0:
            return f"{hours}h{minutes}m{seconds}s"
        elif minutes > 0:
            return f"{minutes}m{seconds}s"
        else:
            return f"{seconds}s"
    
    def create_timestamped_url(self, video_url: str, timestamp: float) -> str:
        """Create a YouTube URL with timestamp"""
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return video_url
        
        seconds = int(timestamp)
        return f"https://www.youtube.com/watch?v={video_id}&t={seconds}s"
