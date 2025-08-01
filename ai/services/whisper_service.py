import whisper
import torch
import numpy as np
import librosa
from typing import Dict, List, Optional, Union
import tempfile
import os
from config import settings
import logging

logger = logging.getLogger(__name__)


class WhisperService:
    """Service for speech-to-text transcription using OpenAI Whisper"""
    
    def __init__(self):
        self.model = None
        self.device = self._get_device()
        
    def _get_device(self) -> str:
        """Determine the best device for inference"""
        if settings.whisper_device == "auto":
            if torch.cuda.is_available():
                return "cuda"
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"  # Apple Silicon
            else:
                return "cpu"
        return settings.whisper_device
    
    async def initialize(self):
        """Initialize the Whisper model"""
        try:
            logger.info(f"Loading Whisper model '{settings.whisper_model}' on device '{self.device}'")
            self.model = whisper.load_model(settings.whisper_model, device=self.device)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    async def transcribe_audio(
        self,
        audio_data: Union[bytes, str],
        language: Optional[str] = None,
        task: str = "transcribe",
        word_timestamps: bool = True
    ) -> Dict:
        """
        Transcribe audio to text
        
        Args:
            audio_data: Audio file bytes or file path
            language: Language code (e.g., 'en', 'es', 'fr')
            task: 'transcribe' or 'translate'
            word_timestamps: Include word-level timestamps
            
        Returns:
            Dictionary with transcription results
        """
        if not self.model:
            raise RuntimeError("Whisper model not initialized")
        
        try:
            # Handle audio data
            if isinstance(audio_data, bytes):
                # Save bytes to temporary file
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                    temp_file.write(audio_data)
                    audio_path = temp_file.name
                
                try:
                    result = await self._transcribe_file(
                        audio_path, language, task, word_timestamps
                    )
                finally:
                    # Clean up temp file
                    os.unlink(audio_path)
                    
            else:
                # Assume it's a file path
                result = await self._transcribe_file(
                    audio_data, language, task, word_timestamps
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
    
    async def _transcribe_file(
        self,
        audio_path: str,
        language: Optional[str],
        task: str,
        word_timestamps: bool
    ) -> Dict:
        """Internal method to transcribe audio file"""
        
        # Whisper options
        options = {
            "task": task,
            "word_timestamps": word_timestamps,
            "verbose": False
        }
        
        if language:
            options["language"] = language
        
        # Run transcription
        result = self.model.transcribe(audio_path, **options)
        
        # Process result
        processed_result = {
            "text": result["text"].strip(),
            "language": result.get("language", "unknown"),
            "duration": self._get_audio_duration(audio_path),
            "segments": []
        }
        
        # Process segments
        if "segments" in result:
            for segment in result["segments"]:
                segment_data = {
                    "id": segment.get("id"),
                    "start": segment.get("start"),
                    "end": segment.get("end"),
                    "text": segment.get("text", "").strip(),
                    "confidence": self._calculate_confidence(segment),
                    "words": []
                }
                
                # Process words if available
                if word_timestamps and "words" in segment:
                    for word in segment["words"]:
                        word_data = {
                            "word": word.get("word", "").strip(),
                            "start": word.get("start"),
                            "end": word.get("end"),
                            "probability": word.get("probability", 0.0)
                        }
                        segment_data["words"].append(word_data)
                
                processed_result["segments"].append(segment_data)
        
        # Calculate overall confidence
        processed_result["confidence"] = self._calculate_overall_confidence(
            processed_result["segments"]
        )
        
        return processed_result
    
    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration in seconds"""
        try:
            y, sr = librosa.load(audio_path)
            return librosa.get_duration(y=y, sr=sr)
        except Exception:
            return 0.0
    
    def _calculate_confidence(self, segment: Dict) -> float:
        """Calculate confidence score for a segment"""
        if "words" in segment:
            # Average word probabilities
            probs = [word.get("probability", 0.0) for word in segment["words"]]
            return sum(probs) / len(probs) if probs else 0.0
        else:
            # Use segment probability if available
            return segment.get("avg_logprob", 0.0)
    
    def _calculate_overall_confidence(self, segments: List[Dict]) -> float:
        """Calculate overall confidence score"""
        if not segments:
            return 0.0
        
        confidences = [seg.get("confidence", 0.0) for seg in segments]
        return sum(confidences) / len(confidences)
    
    async def detect_language(self, audio_data: Union[bytes, str]) -> Dict:
        """Detect the language of audio"""
        if not self.model:
            raise RuntimeError("Whisper model not initialized")
        
        try:
            if isinstance(audio_data, bytes):
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                    temp_file.write(audio_data)
                    audio_path = temp_file.name
            else:
                audio_path = audio_data
            
            try:
                # Load audio
                audio = whisper.load_audio(audio_path)
                audio = whisper.pad_or_trim(audio)
                
                # Make log-Mel spectrogram
                mel = whisper.log_mel_spectrogram(audio).to(self.model.device)
                
                # Detect language
                _, probs = self.model.detect_language(mel)
                
                # Get top languages
                top_languages = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:5]
                
                result = {
                    "detected_language": top_languages[0][0],
                    "confidence": top_languages[0][1],
                    "all_languages": [
                        {"language": lang, "confidence": conf}
                        for lang, conf in top_languages
                    ]
                }
                
                return result
                
            finally:
                if isinstance(audio_data, bytes):
                    os.unlink(audio_path)
                    
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            raise
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
        return list(whisper.tokenizer.LANGUAGES.keys())
    
    def get_model_info(self) -> Dict:
        """Get information about the loaded model"""
        if not self.model:
            return {"status": "not_loaded"}
        
        return {
            "model_name": settings.whisper_model,
            "device": self.device,
            "parameters": sum(p.numel() for p in self.model.parameters()),
            "supported_languages": len(self.get_supported_languages())
        }
