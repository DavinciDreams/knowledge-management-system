import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CollaborationState, User, CollaborationParticipant } from '../types';

// Define Awareness type if not available from types
export interface Awareness {
  [key: string]: any;
}

// Define CollaborationEvent type if not exported from types
export interface CollaborationEvent {
  id: string;
  type: string;
  userId?: string;
  data?: any;
  timestamp: number;
}

// Define Cursor type if not available from types
export interface Cursor {
  x: number;
  y: number;
  color?: string;
  [key: string]: any;
}

// Use CollaborationParticipant from types

interface CollaborationStore extends CollaborationState {
  // Additional properties
  isConnected: boolean;
  connectionState: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  
  // Computed getters
  activeUsers: CollaborationParticipant[];
  
  // Actions
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  setParticipants: (participants: Map<string, User>) => void;
  addParticipant: (user: User) => void;
  removeParticipant: (userId: string) => void;
  setCursors: (cursors: Record<string, Cursor>) => void;
  updateCursor: (userId: string, cursor: Cursor) => void;
  removeCursor: (userId: string) => void;
  setAwareness: (awareness: Record<string, Awareness>) => void;
  updateAwareness: (userId: string, awareness: Awareness) => void;
  addEvent: (event: CollaborationEvent) => void;
  setEvents: (events: CollaborationEvent[]) => void;
  clearEvents: () => void;

  // Connection actions
  connect: (roomId: string, user: User) => Promise<void>;
  disconnect: () => void;
  broadcastCursor: (cursor: Cursor) => void;
  broadcastAwareness: (awareness: Awareness) => void;
  broadcastEvent: (event: Omit<CollaborationEvent, 'id' | 'timestamp'>) => void;
  // Room management
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  switchRoom: (roomId: string) => Promise<void>;
}

export const useCollaborationStore = create<CollaborationStore>()(
  devtools(    (set, get) => ({
      // Initial state
      activeSessions: new Map(),
      pendingOperations: [],
      connectionStatus: 'disconnected',
      participants: new Map(),
      cursors: {},
      awareness: {},
      events: [],
      roomId: null,
        // Additional properties
      isConnected: false,
      connectionState: 'disconnected' as const,

      // Computed getters
      get activeUsers() {
        const participants = get().participants;
        return Array.from(participants.values());
      },

      // Actions
      setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => {
        set({ connectionStatus: status }, false, 'collaboration/setConnectionStatus');
      },

      setParticipants: (participants: Map<string, User>) => {        // Convert Map<string, User> to Map<string, CollaborationParticipant>
        const participantEntries: [string, CollaborationParticipant][] = Array.from(participants.entries()).map(
          ([userId, user]) => [
            userId,
            {
              id: userId,
              userId: user.id,
              name: user.name || 'Unknown User',
              avatar: user.avatar,
              cursor: undefined,
              isActive: true,
              joinedAt: new Date(),
              lastActivity: new Date(),
              permissions: user.role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write']
            }
          ]
        );
        set({ participants: new Map(participantEntries) }, false, 'collaboration/setParticipants');
      },

      addParticipant: (user: User) => {
        const { participants } = get();
        if (!participants.has(user.id)) {
          const newParticipants = new Map(participants);          newParticipants.set(user.id, {
            id: user.id,
            userId: user.id,
            name: user.name || 'Unknown User',
            avatar: user.avatar,
            cursor: undefined,
            isActive: true,
            joinedAt: new Date(),
            lastActivity: new Date(),
            permissions: user.role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write']
          });
          set({ participants: newParticipants }, false, 'collaboration/addParticipant');
        }
      },

      removeParticipant: (userId: string) => {
        const { participants, cursors, awareness } = get();
        const newParticipants = new Map(participants);
        newParticipants.delete(userId);
        const filteredCursors = { ...cursors };
        const filteredAwareness = { ...awareness };
        delete filteredCursors[userId];
        delete filteredAwareness[userId];
        set({
          participants: newParticipants,
          cursors: filteredCursors,
          awareness: filteredAwareness
        }, false, 'collaboration/removeParticipant');
      },

      setCursors: (cursors: Record<string, Cursor>) => {
        set({ cursors }, false, 'collaboration/setCursors');
      },

      updateCursor: (userId: string, cursor: Cursor) => {
        const { cursors } = get();
        set({
          cursors: { ...cursors, [userId]: cursor }
        }, false, 'collaboration/updateCursor');
      },

      removeCursor: (userId: string) => {
        const { cursors } = get();
        const updated = { ...cursors };
        delete updated[userId];
        set({ cursors: updated }, false, 'collaboration/removeCursor');
      },

      setAwareness: (awareness: Record<string, Awareness>) => {
        set({ awareness }, false, 'collaboration/setAwareness');
      },

      updateAwareness: (userId: string, awareness: Awareness) => {
        const { awareness: currentAwareness } = get();
        set({
          awareness: { ...currentAwareness, [userId]: awareness }
        }, false, 'collaboration/updateAwareness');
      },

      addEvent: (event: CollaborationEvent) => {
        const { events } = get();
        const updatedEvents = [event, ...events].slice(0, 100); // Keep last 100 events
        set({ events: updatedEvents }, false, 'collaboration/addEvent');
      },

      setEvents: (events: CollaborationEvent[]) => {
        set({ events }, false, 'collaboration/setEvents');
      },

      clearEvents: () => {
        set({ events: [] }, false, 'collaboration/clearEvents');
      },

      // Connection actions
      connect: async (roomId: string, user: User) => {
        const state = get();

        set({
          connectionStatus: 'reconnecting',
          roomId
        }, false, 'collaboration/connect/start');

        try {
          // TODO: Implement WebSocket connection
          // const ws = new WebSocket(`ws://localhost:8080/ws/${roomId}`);

          // Simulate connection
          await new Promise(resolve => setTimeout(resolve, 1000));

          state.setConnectionStatus('connected');
          state.addParticipant(user);

          // Add connection event
          state.addEvent({
            id: crypto.randomUUID(),
            type: 'user-joined',
            userId: user.id,
            data: { user },
            timestamp: Date.now()
          });

          console.log(`Connected to room: ${roomId}`);

        } catch (error) {
          console.error('Connection failed:', error);
          set({
            connectionStatus: 'disconnected'
          }, false, 'collaboration/connect/error');
        }
      },

      disconnect: () => {
        const { participants, roomId } = get();
        // Find current user (if any)
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }

        if (currentUserId) {
          // Add disconnection event
          get().addEvent({
            id: crypto.randomUUID(),
            type: 'user-left',
            userId: currentUserId,
            data: { userId: currentUserId },
            timestamp: Date.now()
          });
        }

        set({
          connectionStatus: 'disconnected',
          participants: new Map(),
          cursors: {},
          awareness: {},
          events: [],
          roomId: null
        }, false, 'collaboration/disconnect');

        console.log(`Disconnected from room: ${roomId}`);
      },
      broadcastCursor: (cursor: Cursor) => {
        const { participants, connectionStatus } = get();
        // Find current userId (first participant)
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }
        if (connectionStatus !== 'connected' || !currentUserId) return;

        // Update local cursor
        get().updateCursor(currentUserId, cursor);

        // TODO: Broadcast to WebSocket
      },

      broadcastAwareness: (awareness: Awareness) => {
        const { participants, connectionStatus } = get();
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }
        if (connectionStatus !== 'connected' || !currentUserId) return;

        // Update local awareness
        get().updateAwareness(currentUserId, awareness);

        // TODO: Broadcast to WebSocket
      },

      broadcastEvent: (eventData: Omit<CollaborationEvent, 'id' | 'timestamp'>) => {
        const { participants, connectionStatus } = get();
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }
        if (connectionStatus !== 'connected' || !currentUserId) return;

        const event: CollaborationEvent = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          ...eventData
        };

        // Add to local events
        get().addEvent(event);

        // TODO: Broadcast to WebSocket
      },

      joinRoom: async (roomId: string) => {
        const { participants } = get();
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }
        if (!currentUserId) {
          throw new Error('No current user set');
        }        // Use dummy User for connect, or store User in state if needed
        await get().connect(roomId, {
          id: currentUserId,
          email: '',
          name: '',
          role: 'user',          preferences: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
            notifications: { email: true, push: false, mentions: true, updates: true },            canvas: { 
              defaultTool: 'pen',
              gridVisible: false,
              snapToGrid: false,
              penPressureSensitivity: 1,
              autoSave: true,
              autoSaveInterval: 30000
            },
            voice: { 
              inputDevice: 'default',
              outputDevice: 'default',
              voiceToText: true,
              textToVoice: true,
              autoTranscribe: true
            },
            ai: { 
              model: 'gpt-4',
              temperature: 0.7,
              autoSuggestions: true,
              contextWindow: 4000
            }
          },
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      },

      leaveRoom: () => {
        get().disconnect();
      },

      switchRoom: async (roomId: string) => {
        const { participants, connectionStatus } = get();
        let currentUserId: string | undefined;
        for (const [userId] of participants) {
          currentUserId = userId;
          break;
        }
        if (!currentUserId) {
          throw new Error('No current user set');
        }
        
        // Disconnect from current room if connected
        if (connectionStatus === 'connected') {
          get().disconnect();
        }
        
        // Connect to new room
        await get().connect(roomId, {
          id: currentUserId,
          email: '',
          name: '',
          role: 'user',          preferences: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
            notifications: { email: true, push: false, mentions: true, updates: true },
            canvas: { 
              defaultTool: 'pen',
              gridVisible: false,
              snapToGrid: false,
              penPressureSensitivity: 1,
              autoSave: true,
              autoSaveInterval: 30000
            },
            voice: { 
              inputDevice: 'default',
              outputDevice: 'default',
              voiceToText: true,
              textToVoice: true,
              autoTranscribe: true
            },
            ai: { 
              model: 'gpt-4',
              temperature: 0.7,
              autoSuggestions: true,
              contextWindow: 4000
            }
          },
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      }
    })
  )
);
