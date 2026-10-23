import { apiService } from './apiService';
import { logger } from '../../utils/loggerHelper';

export interface ChatMessage {
  _id: string;
  tripId?: string;
  orderId?: string;
  driverId?: string;
  senderId: {
    _id: string;
    name: string;
    email: string;
  };
  senderType: 'driver' | 'dispatcher' | 'admin';
  senderName: string;
  message: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'pdf' | 'document' | 'other';
  fileSize?: number;
  readBy: Array<{
    userId: string;
    readAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessagesResponse {
  success: boolean;
  data: {
    messages: ChatMessage[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  };
  message: string;
}

class ChatService {
  // Get chat messages for a trip
  async getTripChatMessages(
    tripId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ChatMessagesResponse> {
    try {
      const response = await apiService.get(
        `/driver/chat/trip/${tripId}/messages?page=${page}&limit=${limit}`
      );
      return response as ChatMessagesResponse;
    } catch (error: any) {
      console.error('Get chat messages error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to fetch chat messages',
        data: {
          messages: [],
          pagination: { current: 1, pages: 0, total: 0, limit: 50 },
        },
      };
    }
  }

  // Send a chat message (with optional file)
  async sendChatMessage(
    tripId: string,
    message: string,
    fileUri?: string,
    fileName?: string,
    fileType?: string
  ): Promise<{ success: boolean; data?: ChatMessage; message: string }> {
    try {
      const formData = new FormData();
      formData.append('message', message);
      
      if (fileUri) {
        // @ts-ignore - FormData in React Native
        formData.append('file', {
          uri: fileUri,
          type: fileType || 'application/octet-stream',
          name: fileName || 'file',
        } as any);
      }

      // Use fetch directly for FormData in React Native
      const token = await apiService.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const baseURL = apiService.getEndpointInfo().current;
      if (!baseURL) {
        throw new Error('API base URL not configured');
      }
      
      // Ensure baseURL doesn't have trailing slash and endpoint starts with /
      const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
      const response = await fetch(`${cleanBaseURL}/driver/chat/trip/${tripId}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send message' }));
        throw new Error(errorData.message || 'Failed to send message');
      }

      const data = await response.json();
      return data as { success: boolean; data?: ChatMessage; message: string };
    } catch (error: any) {
      console.error('Send chat message error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to send message',
      };
    }
  }

  // Mark messages as read
  async markMessagesAsRead(
    tripId: string
  ): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const response = await apiService.post(
        `/driver/chat/trip/${tripId}/mark-read`,
        {}
      );
      return response as { success: boolean; message: string; count?: number };
    } catch (error: any) {
      console.error('Mark messages as read error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to mark messages as read',
      };
    }
  }

  // Get unread message count
  async getUnreadMessageCount(
    tripId: string
  ): Promise<{ success: boolean; data: { unreadCount: number } }> {
    try {
      const response = await apiService.get(
        `/driver/chat/trip/${tripId}/unread-count`
      );
      return response as { success: boolean; data: { unreadCount: number } };
    } catch (error: any) {
      console.error('Get unread count error:', error);
      return {
        success: false,
        data: { unreadCount: 0 },
      };
    }
  }

  // Get signed URL for chat message file
  async getChatMessageFileSignedUrl(
    messageId: string,
    disposition: 'inline' | 'attachment' = 'inline'
  ): Promise<{ success: boolean; url?: string; expiresIn?: number; message?: string }> {
    try {
      console.log('📎 Requesting signed URL for message:', messageId, 'disposition:', disposition);
      
      const response = await apiService.get(
        `/driver/chat/message/${messageId}/file-signed-url?disposition=${disposition}`
      );
      
      console.log('📎 Signed URL API response (raw):', JSON.stringify(response, null, 2));
      console.log('📎 Response structure:', {
        hasSuccess: 'success' in response,
        hasData: 'data' in response,
        hasUrl: 'url' in response,
        hasError: 'error' in response,
        statusCode: response.statusCode,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });
      
      // Check for error first
      if (!response.success || response.error) {
        const errorMessage = response.error?.message || response.data?.message || response.message || 'Failed to get signed URL';
        console.error('📎 ❌ API returned error:', errorMessage);
        return {
          success: false,
          message: errorMessage
        };
      }
      
      // apiService wraps response in { success, data, error, statusCode }
      // Backend returns { success, url, expiresIn }
      // So we need to extract from response.data
      let url = '';
      let expiresIn = 0;
      
      // Try multiple extraction strategies
      if (response.url) {
        // Direct URL in response (apiService might not wrap it)
        url = response.url;
        expiresIn = response.expiresIn || 3600;
        console.log('📎 Found URL directly in response');
      } else if (response.success && response.data) {
        const backendResponse = response.data;
        
        // Handle nested structure: response.data might be { success, url, expiresIn }
        // or response.data might be { data: { success, url, expiresIn } }
        if (backendResponse.url) {
          // Direct access: { success: true, data: { url, expiresIn } }
          url = backendResponse.url;
          expiresIn = backendResponse.expiresIn || 3600;
          console.log('📎 Found URL in response.data.url');
        } else if (backendResponse.data && backendResponse.data.url) {
          // Nested: { success: true, data: { data: { url, expiresIn } } }
          url = backendResponse.data.url;
          expiresIn = backendResponse.data.expiresIn || 3600;
          console.log('📎 Found URL in response.data.data.url');
        } else if (backendResponse.success !== undefined && backendResponse.url) {
          // Backend response directly: { success: true, url, expiresIn }
          url = backendResponse.url;
          expiresIn = backendResponse.expiresIn || 3600;
          console.log('📎 Found URL in response.data (backend format)');
        } else {
          console.error('📎 ❌ Could not find URL in response.data:', {
            backendResponseKeys: Object.keys(backendResponse),
            hasUrl: 'url' in backendResponse,
            hasData: 'data' in backendResponse
          });
        }
      }
      
      console.log('📎 Extracted signed URL:', {
        success: !!url,
        urlLength: url.length,
        urlPreview: url.substring(0, 100),
        expiresIn
      });
      
      if (url) {
        return {
          success: true,
          url,
          expiresIn
        };
      }
      
      console.error('📎 ❌ Could not extract URL from response');
      
      // Check for error in response
      if (response.error) {
        console.error('📎 ❌ Error in signed URL response:', response.error);
        logger.error('Error in signed URL response', { error: response.error });
      }
      
      // If response structure is different, try direct access
      if (response.url) {
        console.log('📎 Using direct URL from response');
        logger.info('Using direct URL from response');
        return {
          success: true,
          url: response.url,
          expiresIn: response.expiresIn || 3600,
        };
      }
      
      logger.warn('No URL found in response', { response });
      return {
        success: false,
        message: 'Could not extract signed URL from response'
      };
    } catch (error: any) {
      console.error('📎 ❌ Get chat message file signed URL error:', error.message);
      logger.error('Get chat message file signed URL error', error);
      return {
        success: false,
        message: error.message || 'Failed to get signed URL'
      };
    }
  }

  // ===== DRIVER CHAT FUNCTIONS (Global Chat) =====

  // Get chat messages for driver (global chat with dispatcher)
  async getDriverChatMessages(
    driverId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ChatMessagesResponse> {
    try {
      const response = await apiService.get(
        `/driver/chat/driver/${driverId}/messages?page=${page}&limit=${limit}`
      );
      return response as ChatMessagesResponse;
    } catch (error: any) {
      console.error('Get driver chat messages error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to fetch chat messages',
        data: {
          messages: [],
          pagination: { current: 1, pages: 0, total: 0, limit: 50 },
        },
      };
    }
  }

  // Send a chat message to dispatcher (with optional file)
  async sendDriverChatMessage(
    driverId: string,
    message: string,
    fileUri?: string,
    fileName?: string,
    fileType?: string
  ): Promise<{ success: boolean; data?: ChatMessage; message: string }> {
    try {
      const formData = new FormData();
      formData.append('message', message);
      
      if (fileUri) {
        // @ts-ignore - FormData in React Native
        formData.append('file', {
          uri: fileUri,
          type: fileType || 'application/octet-stream',
          name: fileName || 'file',
        } as any);
      }

      // Use fetch directly for FormData in React Native
      const token = await apiService.getStoredToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const baseURL = apiService.getEndpointInfo().current;
      if (!baseURL) {
        throw new Error('API base URL not configured');
      }
      
      // Ensure baseURL doesn't have trailing slash and endpoint starts with /
      const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
      const response = await fetch(`${cleanBaseURL}/driver/chat/driver/${driverId}/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send message' }));
        throw new Error(errorData.message || 'Failed to send message');
      }

      const data = await response.json();
      return data as { success: boolean; data?: ChatMessage; message: string };
    } catch (error: any) {
      console.error('Send driver chat message error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to send message',
      };
    }
  }

  // Mark driver messages as read
  async markDriverMessagesAsRead(
    driverId: string
  ): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const response = await apiService.post(
        `/driver/chat/driver/${driverId}/mark-read`,
        {}
      );
      return response as { success: boolean; message: string; count?: number };
    } catch (error: any) {
      console.error('Mark driver messages as read error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to mark messages as read',
      };
    }
  }

  // Get unread message count for driver chat
  async getDriverUnreadMessageCount(
    driverId: string
  ): Promise<{ success: boolean; data: { unreadCount: number } }> {
    try {
      const response = await apiService.get(
        `/driver/chat/driver/${driverId}/unread-count`
      );
      return response as { success: boolean; data: { unreadCount: number } };
    } catch (error: any) {
      console.error('Get driver unread count error:', error);
      return {
        success: false,
        data: { unreadCount: 0 },
      };
    }
  }
}

export const chatService = new ChatService();

