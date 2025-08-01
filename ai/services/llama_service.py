import ollama
from typing import Dict, List, Optional, AsyncIterator
import json
import logging
from config import settings

logger = logging.getLogger(__name__)


class LlamaService:
    """Service for LLaMA-based chat and text generation using Ollama"""
    
    def __init__(self):
        self.client = None
        self.model_name = settings.llama_model
        
    async def initialize(self):
        """Initialize the Ollama client and ensure model is available"""
        try:
            # Set up Ollama client
            self.client = ollama.Client(host=settings.ollama_host)
            
            # Check if model is available
            await self._ensure_model_available()
            
            logger.info(f"LLaMA service initialized with model: {self.model_name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize LLaMA service: {e}")
            raise
    
    async def _ensure_model_available(self):
        """Ensure the specified model is available, pull if necessary"""
        if not self.client:
            raise RuntimeError("Ollama client is not initialized")
        try:
            # List available models
            models = self.client.list()
            model_names = [model['name'] for model in models['models']]
            
            if self.model_name not in model_names:
                logger.info(f"Model {self.model_name} not found, pulling...")
                self.client.pull(self.model_name)
                logger.info(f"Model {self.model_name} pulled successfully")
            else:
                logger.info(f"Model {self.model_name} is available")
                
        except Exception as e:
            logger.error(f"Error ensuring model availability: {e}")
            raise
    
    async def generate_response(
        self,
        prompt: str,
        context: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False
    ) -> Dict:
        """
        Generate a response from LLaMA
        
        Args:
            prompt: User input prompt
            context: Previous conversation context
            system_prompt: System instruction
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            
        Returns:
            Generated response
        """
        if not self.client:
            raise RuntimeError("LLaMA service not initialized")
        
        try:
            # Prepare messages
            messages = []
            
            if system_prompt:
                messages.append({
                    "role": "system",
                    "content": system_prompt
                })
            
            # Add context if provided
            if context:
                messages.extend(context)
            
            # Add current prompt
            messages.append({
                "role": "user",
                "content": prompt
            })
            
            # Generate response
            response_iter = self.client.chat(
                model=self.model_name,
                messages=messages,
                stream=stream,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens or -1
                }
            )
            
            if stream:
                return {"stream": response_iter}
            else:
                # Consume the iterator and get the last response
                last_response = None
                for resp in response_iter:
                    last_response = resp
                if last_response is None:
                    raise RuntimeError("No response received from LLaMA model")
                # If last_response is a tuple, get the dictionary part
                if isinstance(last_response, tuple):
                    last_response = last_response[1]
                return {
                    "response": last_response['message']['content'],
                    "model": self.model_name,
                    "usage": {
                        "prompt_tokens": last_response.get('prompt_eval_count', 0),
                        "completion_tokens": last_response.get('eval_count', 0),
                        "total_tokens": last_response.get('prompt_eval_count', 0) + last_response.get('eval_count', 0)
                    }
                }
                
        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            raise
    
    async def generate_streaming_response(
        self,
        prompt: str,
        context: Optional[List[Dict]] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ) -> AsyncIterator[str]:
        """Generate streaming response"""
        
        result = await self.generate_response(
            prompt=prompt,
            context=context,
            system_prompt=system_prompt,
            temperature=temperature,
            stream=True
        )
        
        for chunk in result["stream"]:
            if chunk.get('message', {}).get('content'):
                yield chunk['message']['content']
    
    async def summarize_text(
        self,
        text: str,
        max_length: int = 200,
        style: str = "concise"
    ) -> str:
        """Summarize a given text"""
        
        styles = {
            "concise": "Provide a brief, concise summary in 1-2 sentences.",
            "detailed": "Provide a detailed summary covering the main points.",
            "bullet": "Provide a summary in bullet points.",
            "abstract": "Provide an academic-style abstract summary."
        }
        
        system_prompt = f"""You are a text summarization expert. {styles.get(style, styles['concise'])}
        Keep the summary under {max_length} words and focus on the most important information."""
        
        prompt = f"Please summarize the following text:\n\n{text}"
        
        response = await self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3
        )
        
        return response["response"].strip()
    
    async def generate_cv_overview(
        self,
        user_data: Dict,
        projects: List[Dict],
        skills: List[str],
        experience: List[Dict]
    ) -> Dict:
        """Generate a CV-like overview based on user's knowledge base"""
        
        system_prompt = """You are a professional CV generator. Create a comprehensive overview 
        based on the user's projects, skills, and experience data. Format the response as a 
        structured summary that highlights their expertise and contributions."""
        
        data_summary = {
            "projects": len(projects),
            "key_skills": skills[:10],  # Top 10 skills
            "experience_areas": [exp.get("area", "General") for exp in experience]
        }
        
        prompt = f"""
        Based on the following data, create a professional overview:
        
        User Information: {json.dumps(user_data, indent=2)}
        Projects: {json.dumps(projects[:5], indent=2)}  # Top 5 projects
        Skills: {skills}
        Experience: {json.dumps(experience, indent=2)}
        
        Please create:
        1. A professional summary (2-3 sentences)
        2. Key expertise areas
        3. Notable projects and contributions
        4. Technical skills summary
        5. Career highlights
        """
        
        response = await self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.4
        )
        
        return {
            "overview": response["response"],
            "generated_at": "timestamp",
            "data_summary": data_summary
        }
    
    async def classify_content(
        self,
        content: str,
        categories: List[str]
    ) -> Dict:
        """Classify content into predefined categories"""
        
        system_prompt = f"""You are a content classifier. Classify the given content into one or more 
        of these categories: {', '.join(categories)}. 
        Respond with a JSON object containing 'primary_category' and 'confidence' (0-1 scale)."""
        
        prompt = f"Classify this content:\n\n{content}"
        
        response = await self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.2
        )
        
        try:
            # Try to parse JSON response
            result = json.loads(response["response"])
            return result
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "primary_category": "general",
                "confidence": 0.5,
                "raw_response": response["response"]
            }
    
    async def extract_key_points(self, text: str, num_points: int = 5) -> List[str]:
        """Extract key points from text"""
        
        system_prompt = f"""Extract the {num_points} most important key points from the given text. 
        Return each point as a clear, concise statement. Format as a numbered list."""
        
        prompt = f"Extract key points from:\n\n{text}"
        
        response = await self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3
        )
        
        # Parse the numbered list
        lines = response["response"].strip().split('\n')
        key_points = []
        
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
                # Remove numbering/bullets and clean up
                point = line.lstrip('0123456789.-• ').strip()
                if point:
                    key_points.append(point)
        
        return key_points[:num_points]
    
    async def generate_tags(self, content: str, max_tags: int = 10) -> List[str]:
        """Generate relevant tags for content"""
        
        system_prompt = f"""Generate up to {max_tags} relevant tags for the given content. 
        Tags should be single words or short phrases that categorize and describe the content. 
        Return only the tags, separated by commas."""
        
        prompt = f"Generate tags for:\n\n{content}"
        
        response = await self.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.4
        )
        
        # Parse tags
        tags_text = response["response"].strip()
        tags = [tag.strip() for tag in tags_text.split(',')]
        
        # Clean and filter tags
        clean_tags = []
        for tag in tags:
            tag = tag.strip().lower()
            if tag and len(tag) > 1 and tag not in clean_tags:
                clean_tags.append(tag)
        
        return clean_tags[:max_tags]
    
    def get_model_info(self) -> Dict:
        """Get information about the current model"""
        if not self.client:
            return {"status": "not_initialized"}
        
        try:
            models = self.client.list()
            current_model = next(
                (model for model in models['models'] if model['name'] == self.model_name),
                None
            )
            
            return {
                "model_name": self.model_name,
                "status": "available" if current_model else "not_found",
                "size": current_model.get('size') if current_model else None,
                "modified": current_model.get('modified_at') if current_model else None
            }
        except Exception as e:
            logger.error(f"Error getting model info: {e}")
            return {"status": "error", "error": str(e)}
