import { useEffect, useCallback, useRef } from 'react';
import { useCollaborationStore } from '../stores';
import { User, CollaborationParticipant, CollaborationEvent, Cursor, Awareness } from '../types';

export interface UseCollaborationProps {
  roomId: string;
  user: User;
  autoConnect?: boolean;
}

export interface UseCollaborationReturn {
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  activeUsers: CollaborationParticipant[];
  cursors: Record<string, Cursor>;
  awareness: Record<string, Awareness>;
  events: CollaborationEvent[];
  connect: () => Promise<void>;
  disconnect: () => void;
  broadcastCursor: (cursor: Cursor) => void;
  broadcastAwareness: (awareness: Awareness) => void;
  broadcastEvent: (event: Omit<CollaborationEvent, 'id' | 'timestamp'>) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
}

export function useCollaboration({
  roomId,
  user,
  autoConnect = true
}: UseCollaborationProps): UseCollaborationReturn {
  const store = useCollaborationStore();
  const connectionAttempted = useRef(false);

  // Auto-connect when component mounts
  useEffect(() => {
    if (autoConnect && roomId && user && !connectionAttempted.current) {
      connectionAttempted.current = true;
      store.connect(roomId, user).catch(console.error);
    }

    // Cleanup on unmount
    return () => {
      if (store.connectionStatus === 'connected') {
        store.disconnect();
      }
    };
  }, [autoConnect, roomId, user, store]);

  // Reconnect logic (disabled because 'error' is not a valid connectionStatus)
  // If you want to handle errors, consider adding an error state to the store.
  // useEffect(() => {
  //   if (store.connectionStatus === 'error' && autoConnect) {
  //     const timer = setTimeout(() => {
  //       console.log('Attempting to reconnect...');
  //       store.connect(roomId, user).catch(console.error);
  //     }, 5000);
  //
  //     return () => clearTimeout(timer);
  //   }
  // }, [store.connectionStatus, autoConnect, roomId, user, store]);

  const connect = useCallback(async () => {
    if (!roomId || !user) {
      throw new Error('Room ID and user are required');
    }
    await store.connect(roomId, user);
  }, [roomId, user, store]);

  const disconnect = useCallback(() => {
    store.disconnect();
  }, [store]);

  const broadcastCursor = useCallback((cursor: Cursor) => {
    store.broadcastCursor(cursor);
  }, [store]);

  const broadcastAwareness = useCallback((awareness: Awareness) => {
    store.broadcastAwareness(awareness);
  }, [store]);

  const broadcastEvent = useCallback((event: Omit<CollaborationEvent, 'id' | 'timestamp'>) => {
    store.broadcastEvent(event);
  }, [store]);

  const joinRoom = useCallback(async (newRoomId: string) => {
    await store.switchRoom(newRoomId);
  }, [store]);

  const leaveRoom = useCallback(() => {
    store.leaveRoom();
  }, [store]);

  return {
    isConnected: store.connectionStatus === 'connected',
    connectionState: store.connectionStatus === 'reconnecting' ? 'connecting' : store.connectionStatus,
    activeUsers: store.activeUsers,
    cursors: store.cursors,
    awareness: store.awareness,
    events: store.events,
    connect,
    disconnect,
    broadcastCursor,
    broadcastAwareness,
    broadcastEvent,
    joinRoom,
    leaveRoom
  };
}

// Hook for cursor tracking
export interface UseCursorTrackingProps {
  elementRef: React.RefObject<HTMLElement>;
  userId: string;
  enabled?: boolean;
}

export function useCursorTracking({
  elementRef,
  userId,
  enabled = true
}: UseCursorTrackingProps) {
  const { broadcastCursor } = useCollaboration({
    roomId: '', // Will be set by parent
    user: {
      id: userId,
      name: '',
      email: '',
      role: 'user',
      preferences: {} as any,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }
  });

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const cursor: Cursor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        timestamp: Date.now()
      };
      broadcastCursor(cursor);
    };

    const handleMouseLeave = () => {
      // Send cursor with null position to indicate user left
      broadcastCursor({
        x: -1,
        y: -1,
        timestamp: Date.now()
      });
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [elementRef, enabled, broadcastCursor]);
}

// Hook for awareness (what users are currently doing)
export interface UseAwarenessProps {
  activity: string;
  metadata?: Record<string, any>;
  updateInterval?: number;
}

export function useAwareness({
  activity,
  metadata = {},
  updateInterval = 5000
}: UseAwarenessProps) {
  const { broadcastAwareness } = useCollaboration({
    roomId: '', // Will be set by parent
    user: {
      id: '',
      name: '',
      email: '',
      role: 'user',
      preferences: {} as any,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }
  });

  useEffect(() => {
    const awareness: Awareness = {
      activity,
      metadata,
      timestamp: Date.now()
    };

    broadcastAwareness(awareness);

    // Update awareness periodically
    const interval = setInterval(() => {
      broadcastAwareness({
        ...awareness,
        timestamp: Date.now()
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [activity, metadata, updateInterval, broadcastAwareness]);
}

// Hook for real-time collaborative editing
export interface UseCollaborativeEditingProps {
  documentId: string;
  onRemoteChange?: (change: any) => void;
  onUserJoined?: (participant: CollaborationParticipant) => void;
  onUserLeft?: (participant: CollaborationParticipant) => void;
}

export function useCollaborativeEditing({
  documentId,
  onRemoteChange,
  onUserJoined,
  onUserLeft
}: UseCollaborativeEditingProps) {
  const { events, broadcastEvent, activeUsers } = useCollaboration({
    roomId: documentId,
    user: {
      id: '',
      name: '',
      email: '',
      role: 'user',
      preferences: {} as any,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }
  });

  const previousUsersRef = useRef<CollaborationParticipant[]>([]);

  // Track user join/leave events
  useEffect(() => {
    const previousUsers = previousUsersRef.current;
    const currentUsers = activeUsers;

    // Find newly joined users
    const joinedUsers = currentUsers.filter(
      current => !previousUsers.find(prev => prev.id === current.id)
    );

    // Find users who left
    const leftUsers = previousUsers.filter(
      prev => !currentUsers.find(current => current.id === prev.id)
    );

    joinedUsers.forEach(user => onUserJoined?.(user));
    leftUsers.forEach(user => onUserLeft?.(user));

    previousUsersRef.current = currentUsers;
  }, [activeUsers, onUserJoined, onUserLeft]);

  // Handle remote document changes
  useEffect(() => {
    const documentEvents = events.filter(event => 
      event.type === 'document-change' && 
      event.data?.documentId === documentId
    );

    const latestEvent = documentEvents[0];
    if (latestEvent && onRemoteChange) {
      onRemoteChange(latestEvent.data);
    }
  }, [events, documentId, onRemoteChange]);

  const broadcastChange = useCallback((change: any) => {
    broadcastEvent({
      type: 'document-change',
      userId: '', // Will be set by store
      data: {
        documentId,
        change,
        timestamp: Date.now()
      }
    });
  }, [documentId, broadcastEvent]);

  return {
    activeUsers,
    broadcastChange
  };
}
