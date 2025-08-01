import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Mic, 
  Brain, 
  Radio, 
  MessageSquare, 
  Play,
  Pause,
  Volume2,
  Settings,
  Download,
  Share,
  Trash2
} from 'lucide-react'
import VoiceController from './VoiceController'
import EntityDisplay from './EntityDisplay'
import { useVoiceStore } from '../stores/voiceStore'
import { TranscriptionResult, VoiceCommandResult, LanguageDetectionResult } from '../services/voiceService'

interface VoiceDashboardProps {
  notebookId?: string
  className?: string
}

/**
 * Voice Dashboard Component
 * 
 * A comprehensive interface for voice functionality including:
 * - Voice recording and transcription
 * - Entity extraction and display
 * - Voice command processing
 * - Audio playback and management
 */
const VoiceDashboard: React.FC<VoiceDashboardProps> = ({ 
  notebookId, 
  className = '' 
}) => {
  const store = useVoiceStore()
  const [activeTab, setActiveTab] = useState<'record' | 'transcriptions' | 'entities'>('record')
  const [selectedTranscription, setSelectedTranscription] = useState<string | null>(null)
  
  // Mock data for demonstration (in real app, this would come from the store/API)
  const [entities, setEntities] = useState([
    { text: 'John Smith', label: 'PERSON', confidence: 0.95, start: 5, end: 15 },
    { text: 'Next Tuesday', label: 'DATE', confidence: 0.88, start: 32, end: 44 },
    { text: 'Microsoft', label: 'ORG', confidence: 0.92, start: 67, end: 76 },
    { text: 'project meeting', label: 'EVENT', confidence: 0.83, start: 89, end: 104 }
  ])
  
  const [actionItems, setActionItems] = useState([
    {
      id: '1',
      text: 'Schedule meeting with John Smith for next Tuesday',
      priority: 'high' as const,
      dueDate: '2024-01-16',
      completed: false,
      category: 'meeting'
    },
    {
      id: '2', 
      text: 'Review Microsoft project proposal',
      priority: 'medium' as const,
      dueDate: '2024-01-18',
      completed: false,
      category: 'review'
    },
    {
      id: '3',
      text: 'Send follow-up email to team',
      priority: 'low' as const,
      completed: true,
      category: 'communication'
    }
  ])
  // Handle transcription results
  const handleTranscription = useCallback((result: TranscriptionResult) => {
    console.log('Transcription received:', result)
    
    // Simulate entity extraction (in real app, this would be from AI service)
    if (result.transcript.toLowerCase().includes('meeting')) {
      const newEntity = {
        text: 'meeting',
        label: 'EVENT',
        confidence: 0.85,
        start: result.transcript.toLowerCase().indexOf('meeting'),
        end: result.transcript.toLowerCase().indexOf('meeting') + 7
      }
      setEntities(prev => [...prev, newEntity])
    }
  }, [])
  // Handle voice commands
  const handleCommand = useCallback((command: VoiceCommandResult) => {
    console.log('Voice command received:', command)
    
    if (command.action?.type === 'create_note') {
      // Handle note creation
      console.log('Creating note:', command.action.parameters)
    } else if (command.action?.type === 'schedule_event') {
      // Handle event scheduling
      console.log('Scheduling event:', command.action.parameters)
    }
  }, [])

  // Handle language detection
  const handleLanguageDetected = useCallback((result: LanguageDetectionResult) => {
    console.log('Language detected:', result.language, 'Confidence:', result.confidence)
  }, [])

  // Handle entity click
  const handleEntityClick = useCallback((entity: any) => {
    console.log('Entity clicked:', entity)
    // Could open details modal, add to knowledge graph, etc.
  }, [])

  // Handle action item toggle
  const handleActionItemToggle = useCallback((id: string) => {
    setActionItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    )
  }, [])

  const tabs = [
    { id: 'record', label: 'Voice Recorder', icon: Mic },
    { id: 'transcriptions', label: 'Transcriptions', icon: MessageSquare },
    { id: 'entities', label: 'AI Analysis', icon: Brain }
  ] as const

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Radio className="w-8 h-8" />
              Voice Intelligence
            </h2>
            <p className="text-purple-100 mt-1">
              AI-powered voice recording, transcription, and analysis
            </p>
          </div>
            <div className="flex items-center gap-3">
            <button 
              className="p-2 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
              aria-label="Voice settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              className="p-2 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
              aria-label="Download recordings"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'text-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {tab.label}
                
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'record' && (
            <div className="space-y-6">
              {/* Voice Controller */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Voice Recorder
                </h3>
                <VoiceController
                  notebookId={notebookId}
                  onTranscription={handleTranscription}
                  onCommand={handleCommand}
                  onLanguageDetected={handleLanguageDetected}
                />
              </div>

              {/* Real-time Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Recordings</p>
                      <p className="text-2xl font-bold text-blue-900">{store.voiceNotes.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-green-600 font-medium">Entities Found</p>
                      <p className="text-2xl font-bold text-green-900">{entities.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Mic className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Action Items</p>
                      <p className="text-2xl font-bold text-orange-900">{actionItems.filter(item => !item.completed).length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transcriptions' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Transcriptions
              </h3>
              
              {store.voiceNotes.length > 0 ? (
                <div className="space-y-4">
                  {store.voiceNotes.map((note) => (
                    <div
                      key={note.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{note.title}</h4>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                            {note.transcription || 'Transcription pending...'}
                          </p>                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>Duration: {Math.round(note.duration)}s</span>
                            <span>Size: {(note.fileSize / 1024).toFixed(1)}KB</span>
                            <span>Created: {new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <button 
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Play recording"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Share recording"
                          >
                            <Share className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Delete recording"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No transcriptions yet</p>
                  <p className="text-sm">Start recording to see your transcriptions here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'entities' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                AI Analysis Results
              </h3>
              
              <EntityDisplay
                entities={entities}
                actionItems={actionItems}
                isVisible={true}
                onEntityClick={handleEntityClick}
                onActionItemToggle={handleActionItemToggle}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default VoiceDashboard
