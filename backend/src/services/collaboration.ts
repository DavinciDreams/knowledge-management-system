import { Server as SocketIOServer, Socket } from 'socket.io';
import { redis } from './redis';
import { db } from './database';
import { logger } from '../utils/logger';

export interface CollaborationUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  cursor?: {
    x: number;
    y: number;
    timestamp: number;
  };
  selection?: {
    start: number;
    end: number;
    timestamp: number;
  };
  presence: 'active' | 'idle' | 'away';
  lastSeen: number;
}

export interface CollaborationOperation {
  id: string;
  type: 'insert' | 'delete' | 'format' | 'move';
  timestamp: number;
  userId: string;
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CollaborationState {
  users: Record<string, CollaborationUser>;
  operations: CollaborationOperation[];
  version: number;
  lastModified: number;
}

class CollaborationService {
  private io: SocketIOServer;
  private activeRooms: Map<string, Set<string>> = new Map();
  private userSockets: Map<string, string> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    // Apply authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth['token'] || socket.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify token (simplified - in real implementation, use proper JWT verification)
        const user = await this.verifyToken(token);
        if (!user) {
          return next(new Error('Invalid token'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  private async verifyToken(token: string): Promise<any> {
    // Simplified token verification - implement proper JWT verification
    try {
      const sessionData = await redis.get(`session:${token}`);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData as string) as { userId: string };
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true
        }
      });

      return user;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  private handleConnection(socket: Socket): void {
    const user = socket.data.user;
    logger.info(`User ${user.username} connected to collaboration service`);

    // Store socket reference
    this.userSockets.set(user.id, socket.id);

    // Handle room joining
    socket.on('join-room', async (data: { roomId: string; roomType: 'page' | 'canvas' }) => {
      await this.handleJoinRoom(socket, data);
    });

    // Handle leaving room
    socket.on('leave-room', async (data: { roomId: string }) => {
      await this.handleLeaveRoom(socket, data);
    });

    // Handle cursor updates
    socket.on('cursor-update', async (data: { roomId: string; cursor: { x: number; y: number } }) => {
      await this.handleCursorUpdate(socket, data);
    });

    // Handle selection updates
    socket.on('selection-update', async (data: { roomId: string; selection: { start: number; end: number } }) => {
      await this.handleSelectionUpdate(socket, data);
    });

    // Handle content operations
    socket.on('operation', async (data: { roomId: string; operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'userId'> }) => {
      await this.handleOperation(socket, data);
    });

    // Handle presence updates
    socket.on('presence-update', async (data: { roomId: string; presence: 'active' | 'idle' | 'away' }) => {
      await this.handlePresenceUpdate(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      await this.handleDisconnection(socket);
    });

    // Handle voice activity
    socket.on('voice-activity', async (data: { roomId: string; activity: 'speaking' | 'muted' | 'listening' }) => {
      await this.handleVoiceActivity(socket, data);
    });

    // Handle drawing operations (for canvas)
    socket.on('draw-operation', async (data: { roomId: string; operation: any }) => {
      await this.handleDrawOperation(socket, data);
    });
  }

  private async handleJoinRoom(socket: Socket, data: { roomId: string; roomType: 'page' | 'canvas' }): Promise<void> {
    const user = socket.data.user;
    const { roomId, roomType } = data;

    try {
      // Verify user has access to the room
      const hasAccess = await this.verifyRoomAccess(user.id, roomId, roomType);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to room' });
        return;
      }

      // Join the socket room
      await socket.join(roomId);

      // Add user to active rooms
      if (!this.activeRooms.has(roomId)) {
        this.activeRooms.set(roomId, new Set());
      }
      this.activeRooms.get(roomId)!.add(user.id);

      // Get current collaboration state
      const state = await this.getRoomState(roomId);

      // Add user to the state
      state.users[user.id] = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        presence: 'active',
        lastSeen: Date.now()
      };

      // Save updated state
      await this.saveRoomState(roomId, state);

      // Send current state to the joining user
      socket.emit('room-state', state);

      // Notify other users about the new participant
      socket.to(roomId).emit('user-joined', {
        user: state.users[user.id],
        timestamp: Date.now()
      });

      logger.info(`User ${user.username} joined room ${roomId}`);
    } catch (error) {
      logger.error('Error handling join room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleLeaveRoom(socket: Socket, data: { roomId: string }): Promise<void> {
    const user = socket.data.user;
    const { roomId } = data;

    try {
      // Leave the socket room
      await socket.leave(roomId);

      // Remove user from active rooms
      const roomUsers = this.activeRooms.get(roomId);
      if (roomUsers) {
        roomUsers.delete(user.id);
        if (roomUsers.size === 0) {
          this.activeRooms.delete(roomId);
        }
      }

      // Update collaboration state
      const state = await this.getRoomState(roomId);
      delete state.users[user.id];
      await this.saveRoomState(roomId, state);

      // Notify other users
      socket.to(roomId).emit('user-left', {
        userId: user.id,
        timestamp: Date.now()
      });

      logger.info(`User ${user.username} left room ${roomId}`);
    } catch (error) {
      logger.error('Error handling leave room:', error);
    }
  }

  private async handleCursorUpdate(socket: Socket, data: { roomId: string; cursor: { x: number; y: number } }): Promise<void> {
    const user = socket.data.user;
    const { roomId, cursor } = data;

    try {
      const state = await this.getRoomState(roomId);
      if (state.users[user.id]) {
        state.users[user.id]!.cursor = {
          ...cursor,
          timestamp: Date.now()
        };
        state.users[user.id]!.lastSeen = Date.now();
        
        await this.saveRoomState(roomId, state);

        // Broadcast cursor position to other users
        socket.to(roomId).emit('cursor-updated', {
          userId: user.id,
          cursor: state.users[user.id]!.cursor
        });
      }
    } catch (error) {
      logger.error('Error handling cursor update:', error);
    }
  }

  private async handleSelectionUpdate(socket: Socket, data: { roomId: string; selection: { start: number; end: number } }): Promise<void> {
    const user = socket.data.user;
    const { roomId, selection } = data;

    try {
      const state = await this.getRoomState(roomId);
      if (state.users[user.id]) {
        state.users[user.id]!.selection = {
          ...selection,
          timestamp: Date.now()
        };
        state.users[user.id]!.lastSeen = Date.now();
        
        await this.saveRoomState(roomId, state);

        // Broadcast selection to other users
        socket.to(roomId).emit('selection-updated', {
          userId: user.id,
          selection: state.users[user.id]!.selection
        });
      }
    } catch (error) {
      logger.error('Error handling selection update:', error);
    }
  }

  private async handleOperation(socket: Socket, data: { roomId: string; operation: Omit<CollaborationOperation, 'id' | 'timestamp' | 'userId'> }): Promise<void> {
    const user = socket.data.user;
    const { roomId, operation } = data;

    try {
      const state = await this.getRoomState(roomId);
      
      // Create operation with metadata
      const fullOperation: CollaborationOperation = {
        id: `${Date.now()}-${user.id}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        userId: user.id,
        ...operation
      };

      // Apply operational transformation if needed
      const transformedOperation = await this.transformOperation(fullOperation, state.operations);

      // Add to operations log
      state.operations.push(transformedOperation);
      state.version++;
      state.lastModified = Date.now();

      // Keep only recent operations (last 1000)
      if (state.operations.length > 1000) {
        state.operations = state.operations.slice(-1000);
      }

      // Update user activity
      if (state.users[user.id]) {
        state.users[user.id]!.lastSeen = Date.now();
        state.users[user.id]!.presence = 'active';
      }

      await this.saveRoomState(roomId, state);

      // Broadcast operation to other users
      socket.to(roomId).emit('operation-applied', {
        operation: transformedOperation,
        version: state.version
      });

      // Send acknowledgment to sender
      socket.emit('operation-acknowledged', {
        operationId: fullOperation.id,
        version: state.version
      });

      logger.debug(`Operation applied in room ${roomId}: ${transformedOperation.type}`);
    } catch (error) {
      logger.error('Error handling operation:', error);
      socket.emit('operation-error', {
        operationId: data.operation.metadata?.['clientId'],
        error: 'Failed to apply operation'
      });
    }
  }

  private async handlePresenceUpdate(socket: Socket, data: { roomId: string; presence: 'active' | 'idle' | 'away' }): Promise<void> {
    const user = socket.data.user;
    const { roomId, presence } = data;

    try {
      const state = await this.getRoomState(roomId);
      if (state.users[user.id]) {
        state.users[user.id]!.presence = presence;
        state.users[user.id]!.lastSeen = Date.now();
        
        await this.saveRoomState(roomId, state);

        // Broadcast presence update
        socket.to(roomId).emit('presence-updated', {
          userId: user.id,
          presence,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Error handling presence update:', error);
    }
  }

  private async handleDisconnection(socket: Socket): Promise<void> {
    const user = socket.data.user;
    
    try {
      // Remove user from all rooms
      for (const [roomId, users] of this.activeRooms.entries()) {
        if (users.has(user.id)) {
          users.delete(user.id);
          
          // Update room state
          const state = await this.getRoomState(roomId);
          if (state.users[user.id]) {
            state.users[user.id]!.presence = 'away';
            state.users[user.id]!.lastSeen = Date.now();
            await this.saveRoomState(roomId, state);
          }

          // Notify other users
          socket.to(roomId).emit('user-disconnected', {
            userId: user.id,
            timestamp: Date.now()
          });
        }
      }

      // Remove socket reference
      this.userSockets.delete(user.id);

      logger.info(`User ${user.username} disconnected from collaboration service`);
    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  private async handleVoiceActivity(socket: Socket, data: { roomId: string; activity: 'speaking' | 'muted' | 'listening' }): Promise<void> {
    const user = socket.data.user;
    const { roomId, activity } = data;

    // Broadcast voice activity to other users in the room
    socket.to(roomId).emit('voice-activity', {
      userId: user.id,
      activity,
      timestamp: Date.now()
    });
  }

  private async handleDrawOperation(socket: Socket, data: { roomId: string; operation: any }): Promise<void> {
    const user = socket.data.user;
    const { roomId, operation } = data;

    try {
      // Add user info to the operation
      const drawOperation = {
        ...operation,
        userId: user.id,
        timestamp: Date.now()
      };

      // Broadcast drawing operation to other users
      socket.to(roomId).emit('draw-operation', drawOperation);

      // Optionally save to persistent storage for canvas recovery
      await redis.lpush(`canvas:${roomId}:operations`, [JSON.stringify(drawOperation)]);
      
      // Keep only recent operations (last 10000)
      await redis.getClient().ltrim(`canvas:${roomId}:operations`, 0, 9999);
    } catch (error) {
      logger.error('Error handling draw operation:', error);
    }
  }

  private async verifyRoomAccess(userId: string, roomId: string, roomType: 'page' | 'canvas'): Promise<boolean> {
    try {
      const client = db.getClient();
      
      if (roomType === 'page') {
        const page = await client.page.findFirst({
          where: {
            id: roomId,
            OR: [
              { authorId: userId },
              { collaborations: { some: { userId } } },
              { visibility: 'PUBLIC' }
            ]
          }
        });
        return !!page;
      } else if (roomType === 'canvas') {
        const canvas = await client.canvas.findFirst({
          where: {
            id: roomId,
            OR: [
              { ownerId: userId },
              { collaborations: { some: { userId } } },
              { visibility: 'PUBLIC' }
            ]
          }
        });
        return !!canvas;
      }
      
      return false;
    } catch (error) {
      logger.error('Error verifying room access:', error);
      return false;
    }
  }

  private async getRoomState(roomId: string): Promise<CollaborationState> {
    try {
      const cached = await redis.get<CollaborationState>(`collab:${roomId}`);
      if (cached) {
        return cached;
      }

      // Initialize new room state
      const state: CollaborationState = {
        users: {},
        operations: [],
        version: 0,
        lastModified: Date.now()
      };

      await this.saveRoomState(roomId, state);
      return state;
    } catch (error) {
      logger.error('Error getting room state:', error);
      throw error;
    }
  }

  private async saveRoomState(roomId: string, state: CollaborationState): Promise<void> {
    try {
      await redis.set(`collab:${roomId}`, state, 3600); // 1 hour TTL
    } catch (error) {
      logger.error('Error saving room state:', error);
      throw error;
    }
  }

  private async transformOperation(
    operation: CollaborationOperation,
    existingOperations: CollaborationOperation[]
  ): Promise<CollaborationOperation> {
    // Simplified operational transformation
    // In a real implementation, you'd implement proper OT algorithms like those used in Google Docs
    let transformedOperation = { ...operation };

    for (const existingOp of existingOperations) {
      if (existingOp.timestamp > operation.timestamp) {
        continue; // Skip operations that happened after this one
      }

      // Transform based on operation types
      if (existingOp.type === 'insert' && transformedOperation.type === 'insert') {
        if (existingOp.position <= transformedOperation.position) {
          transformedOperation.position += existingOp.content?.length || 0;
        }
      } else if (existingOp.type === 'delete' && transformedOperation.type === 'insert') {
        if (existingOp.position < transformedOperation.position) {
          transformedOperation.position -= existingOp.length || 0;
        }
      }
      // Add more transformation rules as needed
    }

    return transformedOperation;
  }

  // Public methods for external use
  public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    this.io.to(roomId).emit(event, data);
  }

  public async getUsersInRoom(roomId: string): Promise<CollaborationUser[]> {
    const state = await this.getRoomState(roomId);
    return Object.values(state.users);
  }

  public async kickUserFromRoom(roomId: string, userId: string): Promise<void> {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(roomId);
        socket.emit('kicked-from-room', { roomId });
      }
    }

    // Update room state
    const state = await this.getRoomState(roomId);
    delete state.users[userId];
    await this.saveRoomState(roomId, state);

    // Notify other users
    this.io.to(roomId).emit('user-kicked', { userId, timestamp: Date.now() });
  }

  public getActiveRooms(): string[] {
    return Array.from(this.activeRooms.keys());
  }

  public getRoomUserCount(roomId: string): number {
    return this.activeRooms.get(roomId)?.size || 0;
  }
}

export { CollaborationService };
