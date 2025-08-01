import { useEffect, useCallback, useRef, useState } from 'react';
import { useVoiceStore } from '../stores';
import { voiceService, TranscriptionResult, VoiceCommandResult, LanguageDetectionResult, VoiceNote } from '../services/voiceService';

export interface UseVoiceRecordingProps {
  autoStart?: boolean;
  maxDuration?: number;
  autoTranscribe?: boolean;
  autoDetectLanguage?: boolean;
  onTranscription?: (result: TranscriptionResult) => void;
  onCommand?: (command: VoiceCommandResult) => void;
  onLanguageDetected?: (result: LanguageDetectionResult) => void;
  onError?: (error: Error) => void;
}

export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  transcription: TranscriptionResult | null;
  isTranscribing: boolean;
  detectedLanguage: LanguageDetectionResult | null;
  isDetectingLanguage: boolean;
  commandResult: VoiceCommandResult | null;
  isProcessingCommand: boolean;
}

export function useVoiceRecording({
  autoStart = false,
  maxDuration = 300000, // 5 minutes
  autoTranscribe = true,
  autoDetectLanguage = false,
  onTranscription,
  onCommand,
  onLanguageDetected,
  onError
}: UseVoiceRecordingProps = {}): UseVoiceRecordingReturn {
  const store = useVoiceStore();
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageDetectionResult | null>(null);
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [commandResult, setCommandResult] = useState<VoiceCommandResult | null>(null);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const maxDurationTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (autoStart) {
      startRecording().catch(onError || console.error);
    }

    return () => {
      if (maxDurationTimer.current) {
        clearTimeout(maxDurationTimer.current);
      }
    };
  }, [autoStart]);

  const startRecording = useCallback(async () => {
    try {
      await store.startRecording();
      
      // Set max duration timer
      if (maxDuration > 0) {
        maxDurationTimer.current = setTimeout(() => {
          stopRecording();
        }, maxDuration);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, maxDuration, onError]);
  const stopRecording = useCallback(async () => {
    try {
      await store.stopRecording();
      const recording = store.currentRecording;
      
      if (maxDurationTimer.current) {
        clearTimeout(maxDurationTimer.current);
      }

      if (!recording?.blob) {
        return null;
      }

      // Auto-detect language if enabled
      if (autoDetectLanguage) {
        setIsDetectingLanguage(true);
        try {
          const languageResult = await store.detectLanguage(recording.blob);
          setDetectedLanguage(languageResult);
          onLanguageDetected?.(languageResult);
        } catch (error) {
          console.error('Language detection failed:', error);
        } finally {
          setIsDetectingLanguage(false);
        }
      }

      // Auto-transcribe if enabled
      if (autoTranscribe) {
        setIsTranscribing(true);
        try {
          const result = await store.transcribeAudio(recording.blob, {
            language: detectedLanguage?.language || 'auto',
            wordTimestamps: true
          });
          setTranscription(result);
          onTranscription?.(result);

          // Process voice commands if enabled and we have transcription
          if (store.voiceCommandsEnabled && result.transcript) {
            setIsProcessingCommand(true);
            try {
              const commandResult = await store.processVoiceCommand(recording.blob, {
                transcript: result.transcript,
                confidence: result.confidence
              });
              setCommandResult(commandResult);
              onCommand?.(commandResult);
            } catch (error) {
              console.error('Command processing failed:', error);
            } finally {
              setIsProcessingCommand(false);
            }
          }
        } catch (error) {
          console.error('Transcription failed:', error);
          onError?.(error as Error);
        } finally {
          setIsTranscribing(false);
        }
      }

      return recording.blob;
    } catch (error) {
      onError?.(error as Error);
      return null;
    }
  }, [store, autoTranscribe, autoDetectLanguage, detectedLanguage, onTranscription, onCommand, onLanguageDetected, onError]);

  const pauseRecording = useCallback(() => {
    store.pauseRecording();
  }, [store]);

  const resumeRecording = useCallback(() => {
    store.resumeRecording();
  }, [store]);

  const cancelRecording = useCallback(() => {
    store.cancelRecording();
    
    if (maxDurationTimer.current) {
      clearTimeout(maxDurationTimer.current);
    }
    
    setTranscription(null);
    setIsTranscribing(false);
  }, [store]);
  return {
    isRecording: store.isRecording,
    isPaused: store.isPaused,
    duration: store.recordingTime,
    audioLevel: store.inputLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    transcription,
    isTranscribing,
    detectedLanguage,
    isDetectingLanguage,
    commandResult,
    isProcessingCommand
  };
}

// Hook for voice playback
export interface UseVoicePlaybackProps {
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseVoicePlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playAudio: (audioBlob: Blob | string) => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
}

export function useVoicePlayback({
  onPlaybackEnd,
  onError
}: UseVoicePlaybackProps = {}): UseVoicePlaybackReturn {
  const store = useVoiceStore();

  useEffect(() => {
    // Set up playback event listeners
    const handlePlaybackEnd = () => {
      onPlaybackEnd?.();
    };

    const handlePlaybackError = (error: Error) => {
      onError?.(error);
    };

    // Add event listeners if store supports them
    // This would be implemented in the actual Howler.js integration

    return () => {
      // Cleanup event listeners
    };
  }, [onPlaybackEnd, onError]);
  const playAudio = useCallback(async (audioBlob: Blob | string) => {
    try {
      if (typeof audioBlob === 'string') {
        // If it's a URL string, we need to handle it differently
        // For now, we can use the browser's built-in audio playing
        const audio = new Audio(audioBlob);
        await audio.play();
      } else {
        // If it's a Blob, use the store's playAudio method
        await store.playAudio(audioBlob);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, onError]);

  const pauseAudio = useCallback(() => {
    store.pausePlayback();
  }, [store]);

  const resumeAudio = useCallback(() => {
    store.resumePlayback();
  }, [store]);

  const stopAudio = useCallback(() => {
    store.stopPlayback();
  }, [store]);

  const seekTo = useCallback((time: number) => {
    store.seekTo(time);
  }, [store]);

  const setVolume = useCallback((volume: number) => {
    store.setVolume(volume);
  }, [store]);

  return {
    isPlaying: store.isPlaying,
    currentTime: store.playbackTime,
    duration: store.playbackTime,
    volume: store.volume,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio,
    seekTo,
    setVolume
  };
}

// Hook for text-to-speech
export interface UseTextToSpeechProps {
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  speak: (text: string, options?: any) => Promise<void>;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceId: string) => void;
}

export function useTextToSpeech({
  onSpeechEnd,
  onError
}: UseTextToSpeechProps = {}): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const store = useVoiceStore();

  // Local audio playing function
  const playAudioUrl = useCallback(async (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    await audio.play();
  }, []);

  const speak = useCallback(async (text: string, options: any = {}) => {
    try {
      setIsSpeaking(true);
      
      // Use EasySpeech for web TTS or synthesize via API
      if ('speechSynthesis' in window) {
        // Use Web Speech API
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || store.voiceSettings?.speechRate || 1;
        utterance.pitch = options.pitch || store.voiceSettings?.speechPitch || 1;
        utterance.volume = options.volume || store.voiceSettings?.speechVolume || 1;
        
        if (options.voice || store.voiceSettings?.speechVoice) {
          const voices = speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === (options.voice || store.voiceSettings?.speechVoice));
          if (voice) utterance.voice = voice;
        }

        utterance.onend = () => {
          setIsSpeaking(false);
          onSpeechEnd?.();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          onError?.(new Error(event.error));
        };        speechSynthesis.speak(utterance);
      } else {        // Use API service for TTS
        const audioResult = await voiceService.synthesizeSpeech(text, {
          rate: options.rate || store.voiceSettings?.speechRate,
          pitch: options.pitch || store.voiceSettings?.speechPitch,
          volume: options.volume || store.voiceSettings?.speechVolume,
          voice: options.voice || store.voiceSettings?.speechVoice
        });

        // Play the generated audio using the URL
        await playAudioUrl(audioResult.audioUrl);
        setIsSpeaking(false);
        onSpeechEnd?.();
      }
    } catch (error) {
      setIsSpeaking(false);
      onError?.(error as Error);
    }
  }, [store, onSpeechEnd, onError, playAudioUrl]);

  const pauseSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.pause();
    }
  }, []);

  const resumeSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.resume();
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const setRate = useCallback((rate: number) => {
    store.updateVoiceSettings({ speechRate: rate });
  }, [store]);

  const setPitch = useCallback((pitch: number) => {
    store.updateVoiceSettings({ speechPitch: pitch });
  }, [store]);

  const setVoice = useCallback((voiceId: string) => {
    store.updateVoiceSettings({ speechVoice: voiceId });
  }, [store]);

  return {
    isSpeaking,
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    setRate,
    setPitch,
    setVoice
  };
}

// Hook for voice commands
export interface UseVoiceCommandsProps {
  enabled?: boolean;
  onCommand?: (command: VoiceCommandResult) => void;
}

export function useVoiceCommands({
  enabled = true,
  onCommand
}: UseVoiceCommandsProps = {}) {
  const store = useVoiceStore();

  useEffect(() => {
    if (!enabled) return;

    // Set up voice command processing
    const handleVoiceCommand = async (transcript: string) => {
      try {
        // Use processVoiceCommand for string input
        const result = await store.processVoiceCommand(new Blob([transcript], { type: 'text/plain' }), { transcript });
        if (result) {
          onCommand?.(result);
          // Execute built-in commands
          switch (result.intent) {
            case 'search':
              // Trigger search
              break;
            case 'create_note':
              // Create new note
              break;
            case 'navigate':
              // Navigate to page
              break;
            // Add more command handlers
          }
        }
      } catch (error) {
        console.error('Voice command processing failed:', error);
      }
    };

    // This would be connected to the transcription system
    // store.onTranscription(handleVoiceCommand);

    return () => {
      // Cleanup
    };
  }, [enabled, onCommand]);

  return {
    enabled: enabled && store.voiceSettings?.voiceCommandsEnabled,
    toggleEnabled: () => store.updateVoiceSettings({ 
      voiceCommandsEnabled: !store.voiceSettings?.voiceCommandsEnabled 
    })
  };
}

// Hook for AI-powered voice notes management
export interface UseVoiceNotesProps {
  notebookId?: string;
  autoLoad?: boolean;
  onNoteUploaded?: (note: VoiceNote) => void;
  onError?: (error: Error) => void;
}

export interface UseVoiceNotesReturn {
  voiceNotes: VoiceNote[];
  currentVoiceNote: VoiceNote | null;
  isLoading: boolean;
  isUploading: boolean;
  uploadVoiceNote: (audioBlob: Blob, options?: {
    pageId?: string;
    title?: string;
    autoTranscribe?: boolean;
  }) => Promise<VoiceNote>;
  loadVoiceNotes: (filters?: any) => Promise<void>;
  updateVoiceNote: (id: string, updates: any) => Promise<void>;
  deleteVoiceNote: (id: string) => Promise<void>;
  setCurrentVoiceNote: (note: VoiceNote | null) => void;
  triggerTranscription: (noteId: string) => Promise<void>;
}

export function useVoiceNotes({
  notebookId,
  autoLoad = true,
  onNoteUploaded,
  onError
}: UseVoiceNotesProps = {}): UseVoiceNotesReturn {
  const store = useVoiceStore();

  useEffect(() => {
    if (autoLoad) {
      store.loadVoiceNotes(notebookId ? { notebookId } : undefined)
        .catch(onError || console.error);
    }
  }, [autoLoad, notebookId, onError]);

  const uploadVoiceNote = useCallback(async (audioBlob: Blob, options = {}) => {
    if (!notebookId) {
      throw new Error('Notebook ID is required for uploading voice notes');
    }

    try {
      const note = await store.uploadVoiceNote(audioBlob, notebookId, options);
      onNoteUploaded?.(note);
      return note;
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }, [store, notebookId, onNoteUploaded, onError]);

  const loadVoiceNotes = useCallback(async (filters = {}) => {
    const finalFilters = notebookId ? { ...filters, notebookId } : filters;
    try {
      await store.loadVoiceNotes(finalFilters);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, notebookId, onError]);

  const updateVoiceNote = useCallback(async (id: string, updates: any) => {
    try {
      await store.updateVoiceNote(id, updates);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, onError]);

  const deleteVoiceNote = useCallback(async (id: string) => {
    try {
      await store.deleteVoiceNote(id);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, onError]);

  const setCurrentVoiceNote = useCallback((note: VoiceNote | null) => {
    store.setCurrentVoiceNote(note);
  }, [store]);

  const triggerTranscription = useCallback(async (noteId: string) => {
    try {
      await store.triggerTranscription(noteId);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, onError]);

  return {
    voiceNotes: store.voiceNotes,
    currentVoiceNote: store.currentVoiceNote,
    isLoading: store.isProcessing,
    isUploading: store.isProcessing,
    uploadVoiceNote,
    loadVoiceNotes,
    updateVoiceNote,
    deleteVoiceNote,
    setCurrentVoiceNote,
    triggerTranscription
  };
}
