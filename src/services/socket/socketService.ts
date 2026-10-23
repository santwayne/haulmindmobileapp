import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { logger } from '../../utils/loggerHelper';
import { getConfig } from '../../config/env';

let socket: Socket | null = null;

export interface VehicleLocation {
  _id: string;
  internalId: string;
  plateNumber: string;
  make: string;
  model: string;
  currentLocation: {
    latitude: string | number;
    longitude: string | number;
    address?: string;
    updatedAt?: string;
  };
  speed?: number;
  fuelLevel?: number | string | null;
  fuelLevelPercentage?: number | string | null;
  fuelLevelLitres?: number | string | null;
  fuelLevelLiters?: number | string | null;
  fuel?: {
    percentage?: number | string | null;
    level?: number | string | null;
    liters?: number | string | null;
    litres?: number | string | null;
    gallons?: number | string | null;
    rangeKm?: number | string | null;
    updatedAt?: string;
  };
  status?: string;
  driver?: {
    _id: string;
    name: string;
  };
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3; // Reduced to prevent endless retries
  private messageCallbackWrappers = new Map<Function, Function>();

  async initialize(timeout: number = 10000): Promise<void> {
    if (this.socket?.connected) {
      logger.info('Socket already connected');
      return;
    }

    // Clean up a stale disconnected socket before creating a new one
    if (this.socket && !this.socket.connected) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.messageCallbackWrappers.clear();
    }

    try {
      const config = await getConfig();
      // Use .env SOCKET_URL if available, otherwise use config value
      const socketUrl = config.SOCKET_URL || 'http://localhost:3000';
      
      // Log which SOCKET_URL is being used for debugging
      console.log(`🔌 Using SOCKET_URL from: ${config.SOCKET_URL ? 'config' : 'default'}`);
      
      logger.info('Initializing socket connection', { 
        socketUrl,
        platform: Platform.OS
      });
      
      console.log(`🔌 Connecting to Socket.IO at: ${socketUrl}`);
      console.log(`🔌 Platform: ${Platform.OS}`);

      // Test if we can reach the server first (for React Native)
      if (Platform.OS !== 'web') {
        try {
          const testUrl = socketUrl.replace(/\/$/, ''); // Remove trailing slash
          console.log(`🧪 Testing server connection at: ${testUrl}/api/v1/config`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(`${testUrl}/api/v1/config`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log(`✅ Server is reachable via HTTP`);
          } else {
            console.warn(`⚠️ Server responded with status: ${response.status}`);
          }
        } catch (testError: any) {
          const errorMsg = testError?.message || 'Unknown error';
          console.error(`❌ Cannot reach server at ${socketUrl}:`, errorMsg);
          console.error(`   This is likely a network connectivity issue.`);
          console.error(`   Troubleshooting steps:`);
          console.error(`   1. Verify backend server is running on ${socketUrl}`);
          console.error(`   2. Check if mobile device and server are on SAME Wi-Fi network`);
          console.error(`   3. Test in browser: Open http://192.168.31.161:3000/api/v1/health on your phone's browser`);
          console.error(`   4. Windows Firewall: Allow port 3000 for incoming connections`);
          console.error(`   5. Android: Check if network_security_config.xml allows cleartext traffic`);
          console.error(`   6. Try ping: ping 192.168.31.161 from mobile device`);
          // Don't throw - let socket.io try anyway
        }
      }

      // Create a promise that resolves when connected
      return new Promise((resolve, reject) => {
        let resolved = false;
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error('❌ Socket: Connection timeout');
            
            // Disconnect the socket if it exists
            if (this.socket) {
              this.socket.disconnect();
              this.socket = null;
            }
            
            reject(new Error(
              `Socket connection timeout. Please check:\n` +
              `1. Backend server is running on ${socketUrl}\n` +
              `2. Socket.IO is properly configured on the backend\n` +
              `3. No firewall blocking the connection`
            ));
          }
        }, timeout);

        // Configure Socket.IO based on platform
        // For React Native, try polling first (more reliable), then upgrade to websocket
        const socketOptions: any = {
          transports: ['polling', 'websocket'], // Always use polling first for better compatibility
          reconnection: false, // Disable auto-reconnect - we'll handle it manually
          reconnectionAttempts: 0,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          autoConnect: true,
          timeout: 10000, // 10 seconds timeout
          forceNew: false,
          withCredentials: false,
          upgrade: true,
          rememberUpgrade: false,
          // Add path for socket.io
          path: '/socket.io/',
          // Add query parameters for better debugging
          query: {
            platform: Platform.OS,
          },
        };

        this.socket = io(socketUrl, socketOptions);

        // Set up event handlers with connection promise
        const connectHandler = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('Socket connected', { socketId: this.socket?.id });
            console.log('✅ Socket: Connected');
            resolve();
          }
        };

        const connectErrorHandler = (error: any) => {
          this.reconnectAttempts++;
          const errorMsg = error?.message || error?.toString() || 'Unknown error';
          
          logger.error('Socket connection error', { 
            error: errorMsg,
            attempts: this.reconnectAttempts,
            socketUrl,
            description: error?.description
          });
          
          console.error('❌ Socket: Connection failed -', errorMsg);
          
          // If we've had too many errors, reject immediately
          if (this.reconnectAttempts >= 3) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
              }
              reject(new Error(`Failed to connect after ${this.reconnectAttempts} attempts: ${errorMsg}`));
            }
          }
        };

        // Set up handlers using once() so they only fire once
        this.socket.once('connect', connectHandler);
        this.socket.once('connect_error', connectErrorHandler);

        // If already connected (unlikely but possible)
        if (this.socket.connected) {
          clearTimeout(timeoutId);
          this.isConnected = true;
          resolve();
          // Still set up other handlers
          this.setupEventHandlers();
        } else {
          // Set up other event handlers (disconnect, reconnect, etc.)
          this.setupEventHandlers();
          
          // Clean up connect handlers after they fire
          this.socket.once('connect', () => {
            setTimeout(() => {
              this.socket?.off('connect', connectHandler);
              this.socket?.off('connect_error', connectErrorHandler);
            }, 100);
          });
        }
      });
    } catch (error: any) {
      logger.error('Failed to initialize socket', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Only set up connect handler if not already handled in initialize
    if (!this.socket.listeners('connect').length) {
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('Socket connected', { socketId: this.socket?.id });
        console.log('✅ Socket: Connected');
      });
    }

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      logger.warn('Socket disconnected', { reason });
      console.warn('⚠️ Socket: Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      logger.error('Socket connection error', { 
        error: error.message,
        attempts: this.reconnectAttempts 
      });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
      logger.info('Socket reconnected', { attemptNumber });
    });

    this.socket.on('reconnect_error', (error) => {
      logger.error('Socket reconnect error', { error: error.message });
    });

    this.socket.on('reconnect_failed', () => {
      logger.error('Socket reconnect failed - max attempts reached');
    });
  }

  joinVehicle(vehicleId: string): void {
    if (!this.socket || !this.isConnected) {
      logger.warn('Cannot join vehicle - socket not connected', { 
        hasSocket: !!this.socket,
        isConnected: this.isConnected 
      });
      console.warn('⚠️ Socket not connected - cannot join vehicle room');
      return;
    }

    logger.info('Joining vehicle room', { vehicleId, socketId: this.socket.id });
    this.socket.emit('joinVehicle', vehicleId);
  }

  leaveVehicle(): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    logger.info('Leaving vehicle room');
    this.socket.emit('leaveVehicle');
  }

  onVehicleLocation(callback: (vehicle: VehicleLocation) => void): void {
    if (!this.socket) {
      logger.warn('Cannot listen for vehicle location - socket not initialized');
      console.warn('⚠️ Socket not initialized - cannot listen for vehicle location');
      return;
    }

    // Remove any existing listener to avoid duplicates
    this.socket.off('vehicleLocation');

    this.socket.on('vehicleLocation', (vehicle: VehicleLocation) => {
      logger.debug('Received vehicle location update', { 
        vehicleId: vehicle._id,
        internalId: vehicle.internalId,
        plateNumber: vehicle.plateNumber,
        latitude: vehicle.currentLocation?.latitude,
        longitude: vehicle.currentLocation?.longitude,
        speed: vehicle.speed
      });
      callback(vehicle);
    });
  }

  offVehicleLocation(): void {
    if (!this.socket) {
      return;
    }

    this.socket.off('vehicleLocation');
  }

  disconnect(): void {
    if (this.socket) {
      this.leaveVehicle();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      logger.info('Socket disconnected');
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // ==================== CHAT METHODS ====================
  
  // Authenticate socket for chat
  authenticateChat(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Clean token - remove "Bearer " prefix if present
      let cleanToken = token?.trim();
      if (cleanToken?.startsWith('Bearer ')) {
        cleanToken = cleanToken.substring(7).trim();
      }

      if (!cleanToken) {
        reject(new Error('No token provided'));
        return;
      }

      logger.info('Authenticating socket with token', { 
        tokenLength: cleanToken.length,
        tokenPrefix: cleanToken.substring(0, 10) + '...'
      });

      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.socket.emit('authenticate', cleanToken);

      this.socket.once('authenticated', (data) => {
        clearTimeout(timeout);
        logger.info('Socket authenticated for chat', data);
        // Store user ID globally if available
        if (data?.userId) {
          // You can store this in a class property if needed
          logger.info('Authenticated user ID', { userId: data.userId });
        }
        resolve();
      });

      this.socket.once('auth_error', (error) => {
        clearTimeout(timeout);
        logger.error('Socket authentication error', { 
          error,
          message: error?.message || 'Unknown error'
        });
        reject(new Error(error?.message || 'Authentication failed'));
      });
    });
  }

  // Join trip chat room
  joinTripChat(tripId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Join trip chat timeout'));
      }, 5000);

      this.socket.emit('joinTripChat', tripId);

      this.socket.once('joinedTripChat', (data) => {
        clearTimeout(timeout);
        logger.info('Joined trip chat', data);
        resolve();
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        logger.error('Error joining trip chat', error);
        reject(new Error(error.message || 'Failed to join trip chat'));
      });
    });
  }

  // Leave trip chat room
  leaveTripChat(tripId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    logger.info('Leaving trip chat', { tripId });
    this.socket.emit('leaveTripChat', tripId);
  }

  // Send chat message (supports both tripId and orderId)
  sendChatMessage(data: {
    tripId?: string;
    orderId?: string;
    message: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }): void {
    if (!this.socket || !this.isConnected) {
      logger.warn('Cannot send chat message - socket not connected');
      return;
    }

    // Use orderId if available, fallback to tripId
    const chatId = data.orderId || data.tripId;
    logger.info('Sending chat message', { tripId: data.tripId, orderId: data.orderId, chatId });
    this.socket.emit('sendChatMessage', {
      ...data,
      tripId: chatId, // Backend expects tripId but will check for orders first
      orderId: data.orderId || chatId,
    });
  }

  // Mark messages as read
  markMessagesRead(tripId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('markMessagesRead', tripId);
  }

  // Typing indicator
  setTyping(tripId: string, isTyping: boolean): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('typing', { tripId, isTyping });
  }

  // Listen to new messages
  onNewChatMessage(callback: (message: any) => void): void {
    if (!this.socket) {
      logger.warn('Cannot listen for chat messages - socket not initialized');
      return;
    }

    // Remove existing wrapper for this callback if previously registered
    const existingWrapper = this.messageCallbackWrappers.get(callback);
    if (existingWrapper) {
      this.socket.off('newChatMessage', existingWrapper as any);
      this.messageCallbackWrappers.delete(callback);
    }

    // Create wrapper with logging, store it so it can be removed by the original callback reference
    const wrapper = (message: any) => {
      logger.info('📨 Socket received newChatMessage event', {
        messageId: message._id,
        orderId: message.orderId,
        tripId: message.tripId,
        senderId: message.senderId?._id || message.senderId,
        senderName: message.senderName
      });
      callback(message);
    };
    this.messageCallbackWrappers.set(callback, wrapper);
    this.socket.on('newChatMessage', wrapper);

    logger.info('✅ Registered newChatMessage listener');
  }

  // Remove new message listener
  offNewChatMessage(callback?: (message: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      const wrapper = this.messageCallbackWrappers.get(callback);
      if (wrapper) {
        this.socket.off('newChatMessage', wrapper as any);
        this.messageCallbackWrappers.delete(callback);
      }
    } else {
      this.socket.off('newChatMessage');
      this.messageCallbackWrappers.clear();
    }
  }

  // Listen to typing indicator
  onUserTyping(callback: (data: {
    userId: string;
    userName: string;
    tripId: string;
    isTyping: boolean;
  }) => void): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('userTyping', callback);
  }

  // Remove typing listener
  offUserTyping(callback?: (data: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off('userTyping', callback);
    } else {
      this.socket.off('userTyping');
    }
  }

  // Listen to errors
  onChatError(callback: (error: { message: string }) => void): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('error', callback);
  }

  // Remove error listener
  offChatError(callback?: (error: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off('error', callback);
    } else {
      this.socket.off('error');
    }
  }

  // ===== DRIVER CHAT METHODS (Global Chat) =====

  // Join driver chat room
  joinDriverChat(driverId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Join driver chat timeout'));
      }, 10000); // Increased timeout

      // Set up error handler first
      const errorHandler = (error: any) => {
        clearTimeout(timeout);
        logger.error('Error joining driver chat', error);
        this.socket?.off('joinedDriverChat', successHandler);
        reject(new Error(error.message || 'Failed to join driver chat'));
      };

      // Set up success handler
      const successHandler = (data: any) => {
        clearTimeout(timeout);
        logger.info('Joined driver chat', data);
        this.socket?.off('error', errorHandler);
        resolve();
      };

      // Listen for both success and error
      this.socket.once('joinedDriverChat', successHandler);
      this.socket.once('error', errorHandler);

      // Emit join event
      logger.info('Emitting joinDriverChat', { driverId });
      this.socket.emit('joinDriverChat', driverId);
    });
  }

  // Leave driver chat room
  leaveDriverChat(driverId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    logger.info('Leaving driver chat', { driverId });
    this.socket.emit('leaveDriverChat', driverId);
  }

  // Send driver chat message
  sendDriverChatMessage(data: {
    driverId: string;
    message: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }): void {
    if (!this.socket || !this.isConnected) {
      logger.warn('Cannot send driver chat message - socket not connected');
      return;
    }

    logger.info('Sending driver chat message', { driverId: data.driverId });
    this.socket.emit('sendDriverChatMessage', data);
  }

  // ==================== WEBRTC ====================

callUser(data: { to: string; offer: any }) {
  this.socket?.emit("call-user", data);
}

answerCall(data: { to: string; answer: any }) {
  this.socket?.emit("answer-call", data);
}

sendIceCandidate(data: { to: string; candidate: any }) {
  this.socket?.emit("call-ice", data);
}

  // Typing indicator for driver chat
  setDriverTyping(driverId: string, isTyping: boolean): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('driverTyping', { driverId, isTyping });
  }
}

export const socketService = new SocketService();
export default socketService;

