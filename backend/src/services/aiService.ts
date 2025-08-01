import axios, { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  word_timestamps?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  message: string;
  model: string;
  created_at: string;
  done: boolean;
}

export interface EntityExtractionResult {
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
    context: string;
    start_pos: number;
    end_pos: number;
  }>;
  calendar_events?: Array<{
    title: string;
    description: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    attendees: string[];
    confidence: number;
  }>;
  entity_counts: Record<string, number>;
}

export interface SearchResult {
  id: string;
  content: string;
  title?: string;
  metadata: Record<string, any>;
  score: number;
}

export class AIServiceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = process.env['AI_SERVICE_URL'] || 'http://localhost:8001') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('AI Service Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Check if AI service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      logger.error('AI service health check failed:', error);
      return false;
    }
  }

  /**
   * Transcribe audio file
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    options: {
      language?: string;
      task?: 'transcribe' | 'translate';
      wordTimestamps?: boolean;
    } = {}
  ): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio', blob, filename);
      
      if (options.language) formData.append('language', options.language);
      if (options.task) formData.append('task', options.task);
      if (options.wordTimestamps !== undefined) {
        formData.append('word_timestamps', options.wordTimestamps.toString());
      }

      const response = await this.client.post('/api/voice/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes for transcription
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Transcription failed');
      }

      return response.data.transcription;
    } catch (error) {
      logger.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Chat with LLM
   */
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<ChatResponse> {
    try {
      const response = await this.client.post('/api/chat/chat', {
        messages,
        model: options.model,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        stream: options.stream || false,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Chat failed');
      }

      return response.data.response;
    } catch (error) {
      logger.error('Chat error:', error);
      throw new Error('Failed to get chat response');
    }
  }

  /**
   * Summarize text
   */
  async summarizeText(
    text: string,
    options: {
      style?: 'concise' | 'detailed' | 'bullet_points';
      maxLength?: number;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.post('/api/chat/summarize', {
        text,
        style: options.style || 'concise',
        max_length: options.maxLength,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Summarization failed');
      }

      return response.data.summary.summary;
    } catch (error) {
      logger.error('Summarization error:', error);
      throw new Error('Failed to summarize text');
    }
  }

  /**
   * Extract entities from text
   */
  async extractEntities(
    text: string,
    options: {
      includeCalendar?: boolean;
      entityTypes?: string[];
    } = {}
  ): Promise<EntityExtractionResult> {
    try {
      const response = await this.client.post('/api/entities/extract', {
        text,
        include_calendar: options.includeCalendar !== false,
        entity_types: options.entityTypes,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Entity extraction failed');
      }

      return response.data.extraction_result;
    } catch (error) {
      logger.error('Entity extraction error:', error);
      throw new Error('Failed to extract entities');
    }
  }

  /**
   * Semantic search
   */
  async semanticSearch(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filterType?: string;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const response = await this.client.post('/api/search/semantic', {
        query,
        limit: options.limit || 10,
        threshold: options.threshold || 0.7,
        filter_type: options.filterType,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Search failed');
      }

      return response.data.results;
    } catch (error) {
      logger.error('Semantic search error:', error);
      throw new Error('Failed to perform semantic search');
    }
  }

  /**
   * Store document in knowledge base
   */
  async storeDocument(
    content: string,
    options: {
      title?: string;
      source?: string;
      metadata?: Record<string, any>;
      contentType?: string;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.post('/api/ingest/text', {
        content,
        title: options.title,
        source: options.source,
        metadata: options.metadata,
        content_type: options.contentType || 'text',
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Document storage failed');
      }

      return response.data.document_id;
    } catch (error) {
      logger.error('Document storage error:', error);
      throw new Error('Failed to store document');
    }
  }

  /**
   * Ingest voice note
   */
  async ingestVoiceNote(
    audioBuffer: Buffer,
    filename: string,
    options: {
      title?: string;
      transcribe?: boolean;
    } = {}
  ): Promise<{ documentId: string; transcription?: TranscriptionResult }> {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio', blob, filename);
      
      if (options.title) formData.append('title', options.title);
      if (options.transcribe !== undefined) {
        formData.append('transcribe', options.transcribe.toString());
      }

      const response = await this.client.post('/api/ingest/voice-note', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Voice note ingestion failed');
      }

      return {
        documentId: response.data.document_id,
        transcription: response.data.transcription_data,
      };
    } catch (error) {
      logger.error('Voice note ingestion error:', error);
      throw new Error('Failed to ingest voice note');
    }
  }

  /**
   * Generate CV overview
   */
  async generateCVOverview(
    content: string,
    options: {
      style?: 'professional' | 'academic' | 'creative';
      length?: 'short' | 'medium' | 'long';
      focusAreas?: string[];
    } = {}
  ): Promise<string> {
    try {
      const response = await this.client.post('/api/overview/generate-cv', {
        content,
        style: options.style || 'professional',
        length: options.length || 'medium',
        focus_areas: options.focusAreas,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'CV generation failed');
      }

      return response.data.cv_overview;
    } catch (error) {
      logger.error('CV generation error:', error);
      throw new Error('Failed to generate CV overview');
    }
  }

  /**
   * Extract action items
   */
  async extractActionItems(text: string): Promise<Array<{
    text: string;
    fullContext: string;
    confidence: number;
    type: string;
  }>> {
    try {
      const response = await this.client.post('/api/entities/action-items', {
        text,
        priority_threshold: 0.5,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Action item extraction failed');
      }

      return response.data.action_items;
    } catch (error) {
      logger.error('Action items extraction error:', error);
      throw new Error('Failed to extract action items');
    }
  }

  /**
   * Find related content
   */
  async findRelatedContent(text: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const response = await this.client.post('/api/search/find-related', null, {
        params: { text, limit },
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Related content search failed');
      }

      return response.data.related_content;
    } catch (error) {
      logger.error('Related content search error:', error);
      throw new Error('Failed to find related content');
    }
  }
}

// Singleton instance
export const aiServiceClient = new AIServiceClient();
