// API Client and Base Services
export { apiClient, handleApiError, API_CONFIG } from './api';
export type { ApiResponse, ApiError } from './api';

// Search Service
export { searchService } from './searchService';
export type { SearchService } from './searchService';

// Graph Service
export { graphService } from './graphService';
export type { 
  GraphService, 
  GraphFilters, 
  GraphAnalytics 
} from './graphService';

// Canvas Service
export { canvasService } from './canvasService';
export type { 
  CanvasService, 
  CanvasFilters, 
  CanvasSummary, 
  ShareSettings, 
  CanvasVersion, 
  CollaborationPermissions 
} from './canvasService';

// Voice Service
export { voiceService } from './voiceService';
export type { 
  VoiceService, 
  TranscriptionResult, 
  SpeechSynthesisOptions, 
  VoiceCommandResult, 
  VoiceSettings, 
  SupportedLanguage, 
  SupportedVoice, 
  AudioAnalysis, 
  VoiceNote, 
  VoiceNoteMetadata, 
  VoiceNoteFilters 
} from './voiceService';

// Data Ingestion Service
export { dataIngestionService } from './dataIngestionService';
export type { 
  DataIngestionService, 
  IngestionOptions, 
  IngestionResult, 
  BatchIngestionResult, 
  IngestionJob, 
  IngestionStats, 
  SupportedFormat, 
  ExtractedData, 
  EntityExtractionResult, 
  ProcessingResult 
} from './dataIngestionService';
