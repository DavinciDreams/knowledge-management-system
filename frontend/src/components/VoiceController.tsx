import React, { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Loader2, Languages, Brain, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceStore } from '../stores/voiceStore'
import { useVoiceRecording, useVoiceNotes } from '../hooks/useVoice'
import { TranscriptionResult, VoiceCommandResult, LanguageDetectionResult } from '../services/voiceService'
import EasySpeech from 'easy-speech'

interface VoiceControllerProps {
  notebookId?: string;
  onTranscription?: (result: TranscriptionResult) => void;
  onCommand?: (command: VoiceCommandResult) => void;
  onLanguageDetected?: (result: LanguageDetectionResult) => void;
}

/**
 * Voice Controller Component
 * 
 * Handles voice recording, transcription, and text-to-speech functionality
 * using Web Audio API, Whisper for transcription, and EasySpeech for TTS
 */
const VoiceController: React.FC<VoiceControllerProps> = ({ 
  notebookId, 
  onTranscription, 
  onCommand, 
  onLanguageDetected 
}) => {
  const store = useVoiceStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  
  // Refs for audio processing
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const {
    isRecording,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    transcription,
    isTranscribing,
    detectedLanguage,
    isDetectingLanguage,
    commandResult,
    isProcessingCommand
  } = useVoiceRecording({
    autoTranscribe: true,
    autoDetectLanguage: true,
    onTranscription,
    onCommand,
    onLanguageDetected,
    onError: (error) => {
      console.error('Voice recording error:', error);
      store.setError(error.message);
    }
  });

  const {
    isUploading
  } = useVoiceNotes({
    notebookId,
    onNoteUploaded: (note) => {
      console.log('Voice note uploaded:', note);
    },
    onError: (error) => {
      console.error('Voice note error:', error);
      store.setError(error.message);
    }
  });

  // Initialize EasySpeech on component mount
  useEffect(() => {    const initializeTTS = async () => {
      try {
        await EasySpeech.detect()
        const status = EasySpeech.status()
        if (status.status === 'init: complete') {
          console.log('Text-to-speech initialized successfully')
        }
      } catch (error) {
        console.error('Failed to initialize text-to-speech:', error)
      }
    }

    initializeTTS()
  }, [])

  // Audio level visualization
  useEffect(() => {
    if (isRecording && analyzerRef.current) {
      const updateAudioLevel = () => {
        const dataArray = new Uint8Array(analyzerRef.current!.frequencyBinCount)
        analyzerRef.current!.getByteFrequencyData(dataArray)
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
        setLocalAudioLevel(average / 255) // Normalize to 0-1
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      
      updateAudioLevel()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setLocalAudioLevel(0)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording])

  const handleRecordingToggle = async () => {
    if (isRecording) {
      await stopRecording()
    } else {
      try {
        await startRecording()
      } catch (error) {
        console.error('Failed to start recording:', error)
      }
    }
  }

  const speak = async (text: string) => {
    try {
      setIsPlaying(true)
      await EasySpeech.speak({
        text,
        voice: EasySpeech.voices()?.[0], // Use first available voice
        rate: 1,
        pitch: 1,
        volume: 1
      })
    } catch (error) {
      console.error('Text-to-speech error:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const stopSpeaking = () => {
    EasySpeech.cancel()
    setIsPlaying(false)
  }
  const handleSpeakToggle = () => {
    if (isPlaying) {
      stopSpeaking()
    } else if (transcription) {
      const textToSpeak = typeof transcription === 'string' 
        ? transcription 
        : transcription.transcript || JSON.stringify(transcription)
      speak(textToSpeak)
    }
  }

  const isProcessing = isTranscribing || isDetectingLanguage || isProcessingCommand || isUploading
  const displayedAudioLevel = audioLevel || localAudioLevel

  return (
    <div className="voice-controller relative">
      <div className="flex items-center gap-2">
        {/* Text-to-Speech Button */}
        <AnimatePresence>
          {transcription && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSpeakToggle}
              className={`p-2 rounded-full transition-all duration-200 ${
                isPlaying
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
              title={isPlaying ? 'Stop speaking' : 'Read transcript aloud'}
            >
              {isPlaying ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Language Detection Display */}
        <AnimatePresence>
          {detectedLanguage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
            >
              <Languages className="w-3 h-3" />
              <span>{detectedLanguage.language}</span>
              {detectedLanguage.confidence && (
                <span className="text-blue-500">
                  ({Math.round(detectedLanguage.confidence * 100)}%)
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Processing Indicator */}
        <AnimatePresence>
          {(isTranscribing || isDetectingLanguage || isProcessingCommand) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs"
            >
              <Brain className="w-3 h-3" />
              <span>
                {isTranscribing ? 'Transcribing...' : 
                 isDetectingLanguage ? 'Detecting language...' : 
                 'Processing command...'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Recording Button */}
        <div className="relative">
          <button
            onClick={handleRecordingToggle}
            disabled={isProcessing}
            className={`p-3 rounded-full transition-all duration-200 relative overflow-hidden ${
              isRecording
                ? 'bg-red-500 text-white voice-active'
                : isProcessing
                ? 'bg-yellow-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
            title={
              isRecording
                ? 'Stop recording'
                : isProcessing
                ? 'Processing...'
                : 'Start voice recording'
            }
          >
            {/* Audio level visualization */}
            {isRecording && (
              <motion.div
                className="absolute inset-0 bg-red-400 opacity-30"
                animate={{
                  scale: 1 + displayedAudioLevel * 0.3
                }}
                transition={{ duration: 0.1 }}
              />
            )}
            
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-5 h-5" />
              </motion.div>
            ) : isRecording ? (
              <MicOff className="w-5 h-5 relative z-10" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Recording indicator dots */}
          {isRecording && (
            <div className="absolute -top-1 -right-1 flex space-x-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-red-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.5, 1]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          )}

          {/* Recording duration */}
          {isRecording && duration > 0 && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-mono">
                {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transcription Display */}
      <AnimatePresence>
        {transcription && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-full right-0 mb-2 max-w-sm z-50"
          >
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-gray-800">
                  Voice Transcript
                </h4>                <button
                  onClick={() => {
                    // Clear transcription state
                    if (typeof transcription === 'object') {
                      // Reset to null or handle clearing differently
                      console.log('Clearing transcription')
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                  aria-label="Clear transcript"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                {typeof transcription === 'string' ? transcription : transcription.transcript || JSON.stringify(transcription)}
              </p>
              
              {/* Command Result Display */}
              {commandResult && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                  <div className="font-medium text-blue-800 mb-1">Command Result:</div>
                  <div className="text-blue-700">{commandResult.action?.type || 'Unknown action'}</div>
                  {commandResult.action?.parameters && (
                    <div className="text-blue-600 mt-1">{JSON.stringify(commandResult.action.parameters)}</div>
                  )}
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>
                    {isTranscribing ? 'Transcribing audio...' :
                     isDetectingLanguage ? 'Detecting language...' :
                     isProcessingCommand ? 'Processing voice command...' :
                     isUploading ? 'Uploading voice note...' : 'Processing...'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {store.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-full right-0 mb-2 max-w-sm z-50"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm text-red-800">
                  <div className="font-medium mb-1">Voice Error</div>
                  <div>{store.error}</div>
                </div>                <button
                  onClick={() => store.setError(null)}
                  className="text-red-400 hover:text-red-600"
                  aria-label="Clear error"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default VoiceController
