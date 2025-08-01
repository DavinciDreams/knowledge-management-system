import { apiClient, ApiResponse, API_CONFIG } from './api';

export interface VoiceService {
  // Core transcription and AI features
  transcribeAudio: (audioBlob: Blob, options?: TranscriptionOptions) => Promise<TranscriptionResult>;
  detectLanguage: (audioBlob: Blob) => Promise<LanguageDetectionResult>;
  processVoiceCommand: (audioBlob: Blob, context?: VoiceCommandContext) => Promise<VoiceCommandResult>;
  
  // Voice notes management
  uploadVoiceNote: (audioBlob: Blob, metadata: VoiceNoteUploadData) => Promise<VoiceNote>;
  saveVoiceNote: (audioBlob: Blob, transcript: string, metadata?: VoiceNoteMetadata) => Promise<VoiceNote>;
  getVoiceNotes: (filters?: VoiceNoteFilters) => Promise<VoiceNotesResponse>;
  getVoiceNote: (id: string) => Promise<VoiceNote>;
  updateVoiceNote: (id: string, updates: VoiceNoteUpdate) => Promise<VoiceNote>;
  deleteVoiceNote: (id: string) => Promise<void>;
  triggerTranscription: (id: string) => Promise<TranscriptionResult>;
  
  // Speech synthesis and text-to-speech
  synthesizeSpeech: (text: string, options?: SpeechSynthesisOptions) => Promise<SpeechSynthesisResult>;
  
  // Settings and configuration
  getVoiceSettings: () => Promise<VoiceSettings>;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => Promise<VoiceSettings>;
  getSupportedLanguages: () => Promise<SupportedLanguage[]>;
  getSupportedVoices: () => Promise<SupportedVoice[]>;
  getVoiceStatistics: () => Promise<VoiceStatistics>;
  
  // Legacy methods for backwards compatibility
  analyzeAudio: (audioBlob: Blob) => Promise<AudioAnalysis>;
}

// Enhanced interfaces for AI-powered voice features
export interface TranscriptionOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
  wordTimestamps?: boolean;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export interface VoiceCommandContext {
  notebookId?: string;
  pageId?: string;
  selection?: string;
}

export interface VoiceNoteUploadData {
  notebookId: string;
  pageId?: string;
  title?: string;
  duration: number;
  autoTranscribe?: boolean;
}

export interface VoiceNotesResponse {
  voiceNotes: VoiceNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface VoiceNoteUpdate {
  title?: string;
  transcription?: string;
  summary?: string;
  keywords?: string[];
  isPublic?: boolean;
}

export interface SpeechSynthesisResult {
  audioUrl: string;
  duration: number;
  voice: string;
  speed: number;
  pitch: number;
}

export interface VoiceStatistics {
  totalVoiceNotes: number;
  totalDuration: number;
  recentNotes: number;
  averageDuration: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  segments: TranscriptionSegment[];
  duration: number;
  wordCount: number;
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SpeechSynthesisOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: string;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface VoiceCommandResult {
  command: string;
  intent: string;
  entities: VoiceEntity[];
  confidence: number;
  action?: VoiceAction;
}

export interface VoiceEntity {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface VoiceAction {
  type: string;
  parameters: Record<string, any>;
  description: string;
}

export interface VoiceSettings {
  autoTranscribe: boolean;
  transcriptionLanguage: string;
  voiceCommandsEnabled: boolean;
  defaultVoice: string;
  speechSpeed: number;
  speechPitch: number;
  wakeWord: string;
  wakeWordEnabled: boolean;
  speechRate?: number;
  speechVolume?: number;
  speechVoice?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export interface SupportedVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  age: 'child' | 'young' | 'adult' | 'senior';
  style: string[];
  premium: boolean;
}

export interface AudioAnalysis {
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  size: number;
  quality: 'low' | 'medium' | 'high';
  noiseLevel: number;
  speechDetected: boolean;
  languageDetected?: string;
  emotions?: EmotionAnalysis[];
}

export interface EmotionAnalysis {
  emotion: string;
  confidence: number;
  start: number;
  end: number;
}

export interface VoiceNoteMetadata {
  title?: string;
  tags?: string[];
  category?: string;
  linkedContent?: string[];
  location?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface VoiceNote {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  fileSize: number;
  mimeType: string;
  transcription?: string;
  confidence?: number;
  language?: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  notebookId: string;
  pageId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    segments?: any[];
    wordTimestamps?: any[];
    entities?: VoiceEntity[];
  };
  notebook?: {
    id: string;
    title: string;
  };
  page?: {
    id: string;
    title: string;
  };
}

export interface VoiceNoteFilters {
  tags?: string[];
  category?: string;
  dateRange?: { start: Date; end: Date };
  language?: string;
  minDuration?: number;
  maxDuration?: number;
  hasTranscript?: boolean;
}

class VoiceServiceImpl implements VoiceService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = API_CONFIG.BASE_URL;
  }

  async transcribeAudio(audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    if (options?.language) {
      formData.append('language', options.language);
    }
    if (options?.task) {
      formData.append('task', options.task);
    }
    if (options?.wordTimestamps !== undefined) {
      formData.append('wordTimestamps', options.wordTimestamps.toString());
    }

    const response = await fetch(`${this.apiUrl}/voice/transcribe`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async detectLanguage(audioBlob: Blob): Promise<LanguageDetectionResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await fetch(`${this.apiUrl}/voice/detect-language`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Language detection failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async processVoiceCommand(audioBlob: Blob, context?: VoiceCommandContext): Promise<VoiceCommandResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    if (context) {
      formData.append('context', JSON.stringify(context));
    }

    const response = await fetch(`${this.apiUrl}/voice/command`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Voice command processing failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async uploadVoiceNote(audioBlob: Blob, metadata: VoiceNoteUploadData): Promise<VoiceNote> {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('notebookId', metadata.notebookId);
    formData.append('duration', metadata.duration.toString());
    
    if (metadata.pageId) {
      formData.append('pageId', metadata.pageId);
    }
    if (metadata.title) {
      formData.append('title', metadata.title);
    }
    if (metadata.autoTranscribe !== undefined) {
      formData.append('autoTranscribe', metadata.autoTranscribe.toString());
    }

    const response = await fetch(`${this.apiUrl}/voice/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Voice note upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async synthesizeSpeech(text: string, options?: SpeechSynthesisOptions): Promise<SpeechSynthesisResult> {
    const response = await apiClient.post<SpeechSynthesisResult>('/voice/text-to-speech', {
      text,
      voice: options?.voice || 'default',
      speed: options?.rate || 1,
      pitch: options?.pitch || 1
    });

    if (!response.success) {
      throw new Error(response.error || 'Speech synthesis failed');
    }

    return response.data!;
  }
  async getVoiceSettings(): Promise<VoiceSettings> {
    const response = await apiClient.get<VoiceSettings>('/voice/settings');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get voice settings');
    }

    return response.data!;
  }

  async updateVoiceSettings(settings: Partial<VoiceSettings>): Promise<VoiceSettings> {
    const response = await apiClient.put<VoiceSettings>('/voice/settings', settings);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update voice settings');
    }

    return response.data!;
  }

  async getSupportedLanguages(): Promise<SupportedLanguage[]> {
    const response = await apiClient.get<SupportedLanguage[]>('/voice/supported-languages');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get supported languages');
    }

    return response.data || [];
  }

  async getSupportedVoices(): Promise<SupportedVoice[]> {
    // This would need to be implemented on the backend
    const response = await apiClient.get<SupportedVoice[]>('/voice/voices');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get supported voices');
    }

    return response.data || [];
  }

  async getVoiceStatistics(): Promise<VoiceStatistics> {
    const response = await apiClient.get<VoiceStatistics>('/voice/statistics');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get voice statistics');
    }

    return response.data!;
  }

  async analyzeAudio(audioBlob: Blob): Promise<AudioAnalysis> {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await fetch(`${this.apiUrl}/voice/analyze`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Audio analysis failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.analysis;
  }

  async saveVoiceNote(
    audioBlob: Blob, 
    transcript: string, 
    metadata?: VoiceNoteMetadata
  ): Promise<VoiceNote> {
    // Use the enhanced upload method for backwards compatibility
    const uploadData: VoiceNoteUploadData = {
      notebookId: metadata?.linkedContent?.[0] || '', // Default notebook
      title: metadata?.title,
      duration: 0, // Will be calculated
      autoTranscribe: false // Already transcribed
    };

    return this.uploadVoiceNote(audioBlob, uploadData);
  }

  async getVoiceNotes(filters?: VoiceNoteFilters): Promise<VoiceNotesResponse> {
    const params = filters ? this.serializeFilters(filters) : {};
    
    const response = await apiClient.get<VoiceNotesResponse>('/voice/notes', params);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get voice notes');
    }

    return response.data!;
  }

  async getVoiceNote(id: string): Promise<VoiceNote> {
    const response = await apiClient.get<VoiceNote>(`/voice/notes/${id}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get voice note');
    }

    return response.data!;
  }

  async updateVoiceNote(id: string, updates: VoiceNoteUpdate): Promise<VoiceNote> {
    const response = await apiClient.put<VoiceNote>(`/voice/notes/${id}`, updates);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update voice note');
    }

    return response.data!;
  }

  async deleteVoiceNote(id: string): Promise<void> {
    const response = await apiClient.delete(`/voice/notes/${id}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete voice note');
    }
  }

  async triggerTranscription(id: string): Promise<TranscriptionResult> {
    const response = await apiClient.post<TranscriptionResult>(`/voice/transcribe/${id}`, {});

    if (!response.success) {
      throw new Error(response.error || 'Failed to trigger transcription');
    }

    return response.data!;
  }

  private serializeFilters(filters: VoiceNoteFilters): Record<string, string> {
    const params: Record<string, string> = {};

    if (filters.tags?.length) {
      params.tags = filters.tags.join(',');
    }

    if (filters.category) {
      params.category = filters.category;
    }

    if (filters.language) {
      params.language = filters.language;
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        params.startDate = filters.dateRange.start.toISOString();
      }
      if (filters.dateRange.end) {
        params.endDate = filters.dateRange.end.toISOString();
      }
    }

    if (filters.minDuration !== undefined) {
      params.minDuration = filters.minDuration.toString();
    }

    if (filters.maxDuration !== undefined) {
      params.maxDuration = filters.maxDuration.toString();
    }

    if (filters.hasTranscript !== undefined) {
      params.hasTranscript = filters.hasTranscript.toString();
    }

    return params;
  }
}

export const voiceService = new VoiceServiceImpl();
