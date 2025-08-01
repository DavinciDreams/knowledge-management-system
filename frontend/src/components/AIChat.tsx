import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon, 
  StopIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  DocumentTextIcon,
  PhotoIcon,
  LinkIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'image' | 'document' | 'link';
    url: string;
    name: string;
  }[];
  isVoice?: boolean;
  audioUrl?: string;
}

interface Suggestion {
  id: string;
  text: string;
  action: () => void;
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder>();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load initial suggestions
    loadSuggestions();
    
    // Add welcome message
    if (messages.length === 0) {
      addMessage({
        id: 'welcome',
        type: 'ai',
        content: "Hello! I'm your AI assistant. I can help you search your knowledge base, create content, analyze information, and answer questions. How can I assist you today?",
        timestamp: new Date()
      });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const loadSuggestions = () => {
    const defaultSuggestions: Suggestion[] = [
      {
        id: '1',
        text: 'Search my notes about project planning',
        action: () => handleSuggestionClick('Search my notes about project planning')
      },
      {
        id: '2',
        text: 'Summarize my recent canvas diagrams',
        action: () => handleSuggestionClick('Summarize my recent canvas diagrams')
      },
      {
        id: '3',
        text: 'Create a new note template',
        action: () => handleSuggestionClick('Create a new note template')
      },
      {
        id: '4',
        text: 'Analyze trends in my voice notes',
        action: () => handleSuggestionClick('Analyze trends in my voice notes')
      }
    ];
    setSuggestions(defaultSuggestions);
  };

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText,
      timestamp: new Date()
    };

    addMessage(userMessage);
    setInputText('');
    setIsLoading(true);
    setSuggestions([]);

    try {
      // TODO: Replace with actual AI API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `I understand you're asking about: "${userMessage.content}". Let me search your knowledge base and provide relevant information. This is a mock response - in the full implementation, I would process your request using the AI service and return relevant results from your notes, canvases, and voice recordings.`,
        timestamp: new Date()
      };

      addMessage(aiResponse);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        
        // TODO: Send to speech-to-text service
        const userMessage: Message = {
          id: Date.now().toString(),
          type: 'user',
          content: 'Voice message recorded',
          timestamp: new Date(),
          isVoice: true,
          audioUrl
        };
        
        addMessage(userMessage);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      // TODO: Stop TTS
      setIsSpeaking(false);
    } else {
      // TODO: Start TTS for last AI message
      setIsSpeaking(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            AI Assistant
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask questions, search your knowledge base, or get help with tasks
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSpeech}
            className={`p-2 rounded-lg transition-colors ${
              isSpeaking 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
            title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
          >
            {isSpeaking ? (
              <SpeakerXMarkIcon className="w-5 h-5" />
            ) : (
              <SpeakerWaveIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {message.isVoice && message.audioUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MicrophoneIcon className="w-4 h-4" />
                    <span className="text-sm">Voice Message</span>
                  </div>
                  <audio controls className="w-full">
                    <source src={message.audioUrl} type="audio/wav" />
                  </audio>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              
              {message.attachments && (
                <div className="mt-2 space-y-1">
                  {message.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      {attachment.type === 'image' && <PhotoIcon className="w-4 h-4" />}
                      {attachment.type === 'document' && <DocumentTextIcon className="w-4 h-4" />}
                      {attachment.type === 'link' && <LinkIcon className="w-4 h-4" />}
                      <span className="truncate">{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className={`text-xs mt-1 ${
                message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-2xl">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={suggestion.action}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or question..."
              rows={1}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRecording 
                ? 'bg-red-500 text-white pulse' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isRecording ? (
              <div className="relative">
                <StopIcon className="w-5 h-5" />
                {recordingTime > 0 && (
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-red-600 dark:text-red-400 font-mono">
                    {formatTime(recordingTime)}
                  </span>
                )}
              </div>
            ) : (
              <MicrophoneIcon className="w-5 h-5" />
            )}
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
