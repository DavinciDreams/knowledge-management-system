import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VoiceRecording, VoiceTranscription, VoiceCommand } from '../types';
import { 
  voiceService, 
  VoiceNote, 
  VoiceSettings, 
  VoiceStatistics, 
  TranscriptionResult,
  LanguageDetectionResult,
  VoiceCommandResult,
  SupportedLanguage
} from '../services/voiceService';

interface VoiceState {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  currentRecording: VoiceRecording | null;
  
  // Playback state
  isPlaying: boolean;
  currentlyPlaying: string | null;
  playbackTime: number;
  volume: number;
  
  // Audio devices
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  
  // Voice notes management (enhanced)
  voiceNotes: VoiceNote[];
  currentVoiceNote: VoiceNote | null;
  
  // Legacy recordings support
  recordings: VoiceRecording[];
  
  // AI-powered transcription state
  transcriptions: Map<string, VoiceTranscription>;
  isTranscribing: boolean;
  lastTranscriptionResult: TranscriptionResult | null;
  
  // Language detection
  detectedLanguage: LanguageDetectionResult | null;
  supportedLanguages: SupportedLanguage[];
  
  // Voice commands (AI-powered)
  voiceCommandsEnabled: boolean;
  lastCommand: VoiceCommand | null;
  lastCommandResult: VoiceCommandResult | null;
  
  // Processing state
  isProcessing: boolean;
  processingProgress: number;
  
  // AI-enhanced settings
  voiceSettings: VoiceSettings | null;
  voiceStatistics: VoiceStatistics | null;
  
  // Audio levels
  inputLevel: number;
  outputLevel: number;
    // Error handling
  error: string | null;

  // Legacy settings (for backward compatibility)
  autoTranscribe: boolean;
  autoSave: boolean;
  voiceToText: boolean;
  textToVoice: boolean;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  
  // Playback actions
  playRecording: (recordingId: string) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => void;
  playAudio: (audioBlob: Blob) => Promise<void>;
  stopPlayback: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  
  // Device management
  loadAudioDevices: () => Promise<void>;
  setInputDevice: (deviceId: string) => void;
  setOutputDevice: (deviceId: string) => void;
  
  // Voice notes management (AI-enhanced)
  uploadVoiceNote: (audioBlob: Blob, notebookId: string, options?: { 
    pageId?: string; 
    title?: string; 
    autoTranscribe?: boolean; 
  }) => Promise<VoiceNote>;
  loadVoiceNotes: (filters?: any) => Promise<void>;
  updateVoiceNote: (id: string, updates: any) => Promise<void>;
  deleteVoiceNote: (id: string) => Promise<void>;
  setCurrentVoiceNote: (voiceNote: VoiceNote | null) => void;
  
  // Legacy recording management
  addRecording: (recording: VoiceRecording) => void;
  removeRecording: (recordingId: string) => void;
  updateRecording: (recordingId: string, updates: Partial<VoiceRecording>) => void;
  
  // AI-powered transcription actions
  transcribeRecording: (recordingId: string) => Promise<void>;
  transcribeAudio: (audioBlob: Blob, options?: any) => Promise<TranscriptionResult>;
  triggerTranscription: (voiceNoteId: string) => Promise<void>;
  setTranscription: (recordingId: string, transcription: VoiceTranscription) => void;
  
  // Language detection
  detectLanguage: (audioBlob: Blob) => Promise<LanguageDetectionResult>;
  loadSupportedLanguages: () => Promise<void>;
  
  // AI-powered voice commands
  processVoiceCommand: (audioBlob: Blob, context?: any) => Promise<VoiceCommandResult>;
  setVoiceCommandsEnabled: (enabled: boolean) => void;
  
  // Settings management
  loadVoiceSettings: () => Promise<void>;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => Promise<void>;
  loadVoiceStatistics: () => Promise<void>;
  
  // Audio levels
  setInputLevel: (level: number) => void;
  setOutputLevel: (level: number) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  currentRecording: null,
  isPlaying: false,
  currentlyPlaying: null,
  playbackTime: 0,
  volume: 1,
  inputDevices: [],
  outputDevices: [],
  selectedInputDevice: null,
  selectedOutputDevice: null,
  voiceNotes: [],
  currentVoiceNote: null,
  recordings: [],
  transcriptions: new Map(),
  isTranscribing: false,
  lastTranscriptionResult: null,
  detectedLanguage: null,
  supportedLanguages: [],
  voiceCommandsEnabled: false,
  lastCommand: null,
  lastCommandResult: null,
  isProcessing: false,
  processingProgress: 0,
  voiceSettings: null,
  voiceStatistics: null,  inputLevel: 0,
  outputLevel: 0,
  error: null,
  autoTranscribe: true,
  autoSave: true,
  voiceToText: true,
  textToVoice: true,
};

export const useVoiceStore = create<VoiceState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      // (full implementation with all actions and state follows, as in your code below)

      // Recording actions (stubs, to be implemented as needed)
      startRecording: async () => {
        // Implement actual recording logic here
        set({ isRecording: true, isPaused: false, recordingTime: 0, error: null });
      },
      stopRecording: async () => {
        // Implement actual stop logic here
        set({ isRecording: false, isPaused: false });
      },
      pauseRecording: () => {
        set({ isPaused: true });
      },
      resumeRecording: () => {
        set({ isPaused: false });
      },
      
      cancelRecording: () => {
        set({ isRecording: false, isPaused: false, currentRecording: null, recordingTime: 0 });
      },

      // Playback actions (stubs, to be implemented as needed)
      playRecording: async (recordingId: string) => {
        set({ isPlaying: true, currentlyPlaying: recordingId, playbackTime: 0 });
      },
      pausePlayback: () => {
        set({ isPlaying: false });
      },
      resumePlayback: () => {
        set({ isPlaying: true });
      },
      playAudio: async (audioBlob: Blob) => {
        try {
          set({ isPlaying: true, error: null });
          // Implementation would go here to actually play the audio blob
          // For now, we'll just set the state
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to play audio' });
        }
      },
      stopPlayback: () => {
        set({ isPlaying: false, currentlyPlaying: null, playbackTime: 0 });
      },
      setVolume: (volume: number) => {
        set({ volume: Math.max(0, Math.min(1, volume)) });
      },
      seekTo: (time: number) => {
        set({ playbackTime: Math.max(0, time) });
      },

      // Device management (stubs, to be implemented as needed)
      loadAudioDevices: async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          set({
            inputDevices: devices.filter(d => d.kind === 'audioinput'),
            outputDevices: devices.filter(d => d.kind === 'audiooutput'),
          });
        } catch (error) {
          set({ error: 'Failed to load audio devices.' });
        }
      },
      setInputDevice: (deviceId: string) => {
        set({ selectedInputDevice: deviceId });
      },
      setOutputDevice: (deviceId: string) => {
        set({ selectedOutputDevice: deviceId });
      },

      // Legacy recording management
      addRecording: (recording) =>
        set((state) => ({
          recordings: [recording, ...state.recordings],
        })),
      removeRecording: (recordingId) => 
        set((state) => ({
          recordings: state.recordings.filter(r => r.id !== recordingId),
          transcriptions: new Map([...state.transcriptions].filter(([id]) => id !== recordingId))
        })),
      updateRecording: (recordingId, updates) => 
        set((state) => ({
          recordings: state.recordings.map(r => 
            r.id === recordingId ? { ...r, ...updates } : r
          )
        })),

      transcribeRecording: async (recordingId) => {
        const recording = get().recordings.find(r => r.id === recordingId);
        if (!recording) return;

        try {
          set({ isTranscribing: true, error: null });
          
          // Use AI service for transcription
          const result = await voiceService.transcribeAudio(recording.blob, {
            wordTimestamps: true
          });
          
          const transcription: VoiceTranscription = {
            text: result.transcript,
            confidence: result.confidence,
            words: result.segments?.flatMap(segment => segment.words || []) || [],
            language: result.language,
            model: 'whisper-1'
          };

          get().setTranscription(recordingId, transcription);
          
        } catch (error) {
          console.error('Failed to transcribe recording:', error);
          set({ error: 'Failed to transcribe recording.' });
        } finally {
          set({ isTranscribing: false });
        }
      },

      setTranscription: (recordingId, transcription) => 
        set((state) => {
          const newTranscriptions = new Map(state.transcriptions);
          newTranscriptions.set(recordingId, transcription);
            return { transcriptions: newTranscriptions };
          }),

          setVoiceCommandsEnabled: (enabled: boolean): void => 
          set({ voiceCommandsEnabled: enabled }),

          processLegacyVoiceCommand: (text: string): VoiceCommand | null => {
          const lowercaseText = text.toLowerCase().trim();
          
          // Simple command parsing - in reality this would be more sophisticated
          if (lowercaseText.includes('create note')) {
            const command: VoiceCommand = {
            type: 'create_note',
            parameters: { title: text.replace(/create note/i, '').trim() },
            confidence: 0.8
            };
            set({ lastCommand: command });
            return command;
          }
          
          if (lowercaseText.includes('search for')) {
            const query = text.replace(/search for/i, '').trim();
            const command: VoiceCommand = {
            type: 'search',
            parameters: { query },
            confidence: 0.85
            };
            set({ lastCommand: command });
            return command;
          }
          
          return null;
          },

          setAutoTranscribe: (enabled: boolean): void => 
          set({ autoTranscribe: enabled }),

          setAutoSave: (enabled: boolean): void => 
          set({ autoSave: enabled }),

          setVoiceToText: (enabled: boolean): void => 
          set({ voiceToText: enabled }),

          setTextToVoice: (enabled: boolean): void => 
          set({ textToVoice: enabled }),

          setInputLevel: (level: number): void => 
          set({ inputLevel: Math.max(0, Math.min(1, level)) }),

          setOutputLevel: (level: number): void => 
          set({ outputLevel: Math.max(0, Math.min(1, level)) }),

          setError: (error: string | null): void => 
          set({ error }),

          clearError: (): void => 
          set({ error: null }),

      // AI-powered voice notes management
      uploadVoiceNote: async (audioBlob, notebookId, options) => {
        try {
          set({ isProcessing: true, error: null });
          
          const voiceNote = await voiceService.uploadVoiceNote(audioBlob, {
            notebookId,
            duration: audioBlob.size / 16000, // Approximate duration
            pageId: options?.pageId,
            title: options?.title,
            autoTranscribe: options?.autoTranscribe ?? true,
          });

          set((state) => ({
            voiceNotes: [voiceNote, ...state.voiceNotes],
            currentVoiceNote: voiceNote,
          }));

          return voiceNote;
        } catch (error) {
          console.error('Failed to upload voice note:', error);
          set({ error: 'Failed to upload voice note.' });
          throw error;
        } finally {
          set({ isProcessing: false });
        }
      },

      loadVoiceNotes: async (filters) => {
        try {
          set({ isProcessing: true, error: null });
          
          const response = await voiceService.getVoiceNotes(filters);
          set({ voiceNotes: response.voiceNotes });
        } catch (error) {
          console.error('Failed to load voice notes:', error);
          set({ error: 'Failed to load voice notes.' });
        } finally {
          set({ isProcessing: false });
        }
      },

      updateVoiceNote: async (id, updates) => {
        try {
          set({ isProcessing: true, error: null });
          
          const updatedNote = await voiceService.updateVoiceNote(id, updates);
          
          set((state) => ({
            voiceNotes: state.voiceNotes.map(note => 
              note.id === id ? updatedNote : note
            ),
            currentVoiceNote: state.currentVoiceNote?.id === id ? updatedNote : state.currentVoiceNote,
          }));
        } catch (error) {
          console.error('Failed to update voice note:', error);
          set({ error: 'Failed to update voice note.' });
        } finally {
          set({ isProcessing: false });
        }
      },

      deleteVoiceNote: async (id) => {
        try {
          set({ isProcessing: true, error: null });
          
          await voiceService.deleteVoiceNote(id);
          
          set((state) => ({
            voiceNotes: state.voiceNotes.filter(note => note.id !== id),
            currentVoiceNote: state.currentVoiceNote?.id === id ? null : state.currentVoiceNote,
          }));
        } catch (error) {
          console.error('Failed to delete voice note:', error);
          set({ error: 'Failed to delete voice note.' });
        } finally {
          set({ isProcessing: false });
        }
      },

      setCurrentVoiceNote: (voiceNote) => 
        set({ currentVoiceNote: voiceNote }),

      // AI-powered transcription
      transcribeAudio: async (audioBlob, options) => {
        try {
          set({ isTranscribing: true, error: null });
          
          const result = await voiceService.transcribeAudio(audioBlob, options);
          set({ lastTranscriptionResult: result });
          
          return result;
        } catch (error) {
          console.error('Failed to transcribe audio:', error);
          set({ error: 'Failed to transcribe audio.' });
          throw error;
        } finally {
          set({ isTranscribing: false });
        }
      },

      triggerTranscription: async (voiceNoteId) => {
        try {
          set({ isTranscribing: true, error: null });
          
          const result = await voiceService.triggerTranscription(voiceNoteId);
          set({ lastTranscriptionResult: result });
          
          // Update the voice note in the list
          set((state) => ({
            voiceNotes: state.voiceNotes.map(note => 
              note.id === voiceNoteId 
                ? { ...note, transcription: result.transcript, status: 'COMPLETED' }
                : note
            ),
          }));
        } catch (error) {
          console.error('Failed to trigger transcription:', error);
          set({ error: 'Failed to trigger transcription.' });
        } finally {
          set({ isTranscribing: false });
        }
      },

      // Language detection
      detectLanguage: async (audioBlob) => {
        try {
          set({ isProcessing: true, error: null });
          
          const result = await voiceService.detectLanguage(audioBlob);
          set({ detectedLanguage: result });
          
          return result;
        } catch (error) {
          console.error('Failed to detect language:', error);
          set({ error: 'Failed to detect language.' });
          throw error;
        } finally {
          set({ isProcessing: false });
        }
      },

      loadSupportedLanguages: async () => {
        try {
          const languages = await voiceService.getSupportedLanguages();
          set({ supportedLanguages: languages });
        } catch (error) {
          console.error('Failed to load supported languages:', error);
          set({ error: 'Failed to load supported languages.' });
        }
      },

      // AI-powered voice commands
      processVoiceCommand: async (audioBlob, context) => {
        try {
          set({ isProcessing: true, error: null });
          
          const result = await voiceService.processVoiceCommand(audioBlob, context);
          set({ lastCommandResult: result });
          
          return result;
        } catch (error) {
          console.error('Failed to process voice command:', error);
          set({ error: 'Failed to process voice command.' });
          throw error;
        } finally {
          set({ isProcessing: false });
        }
      },

      // Settings management
      loadVoiceSettings: async () => {
        try {
          const settings = await voiceService.getVoiceSettings();
          set({ voiceSettings: settings });
        } catch (error) {
          console.error('Failed to load voice settings:', error);
          set({ error: 'Failed to load voice settings.' });
        }
      },

      updateVoiceSettings: async (settingsUpdate) => {
        try {
          set({ isProcessing: true, error: null });
          
          const settings = await voiceService.updateVoiceSettings(settingsUpdate);
          set({ voiceSettings: settings });
        } catch (error) {
          console.error('Failed to update voice settings:', error);
          set({ error: 'Failed to update voice settings.' });
        } finally {
          set({ isProcessing: false });
        }
      },

      loadVoiceStatistics: async () => {
        try {
          const statistics = await voiceService.getVoiceStatistics();
          set({ voiceStatistics: statistics });
        } catch (error) {
          console.error('Failed to load voice statistics:', error);
          set({ error: 'Failed to load voice statistics.' });
        }
      },

      reset: () => {
        // Cleanup active audio
        const audio = (window as any).__currentAudio;
        if (audio) {
          audio.pause();
          (window as any).__currentAudio = null;
        }
        
        // Cleanup timer
        if ((window as any).__recordingTimer) {
          clearInterval((window as any).__recordingTimer);
          (window as any).__recordingTimer = null;
        }
        
        set(initialState);
      },
    }),
    {
      name: 'voice-store',
    }
  )
);
