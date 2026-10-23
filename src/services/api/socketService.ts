// src/services/socket.ts
import io, { Socket } from 'socket.io-client';
import { SOCKET_URL, IS_DEV } from '../../config/env';

class SocketService {
  private socket: Socket | null = null;
  private connectionListeners: Array<(connected: boolean) => void> = [];

  constructor() {
    this.connect();
  }

  connect() {
    try {
      console.log('🔌 Connecting to socket:', SOCKET_URL);
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket?.id);
        this.notifyConnectionListeners(true);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        this.notifyConnectionListeners(false);
      });

      this.socket.on('connect_error', (error) => {
        console.error('🔥 Socket connection error:', error);
        this.notifyConnectionListeners(false);
      });

      // Custom events
      this.socket.on('driver_update', (data) => {
        console.log('📍 Driver update:', data);
      });

    } catch (error) {
      console.error('Socket connection failed:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Check if socket is connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Emit events
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      console.log(`📤 Emitted: ${event}`, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  // Listen to events
  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  // Remove event listener
  off(event: string, callback?: (data: any) => void) {
    this.socket?.off(event, callback);
  }

  // Subscribe to connection status changes
  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    // Immediately call with current status
    callback(this.isConnected());
  }

  // Remove connection listener
  removeConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(
      listener => listener !== callback
    );
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected));
  }
}

export const socketService = new SocketService();