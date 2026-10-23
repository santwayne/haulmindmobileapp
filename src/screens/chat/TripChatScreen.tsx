import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { chatService, ChatMessage } from '../../services/api/chatService';
import { socketService } from '../../services/socket/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/loggerHelper';

const TripChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // Support both tripId and orderId (since we're using orders now, tripId is actually orderId)
  const { tripId, orderId, tripNumber, orderNumber } = route.params as { 
    tripId?: string; 
    orderId?: string; 
    tripNumber?: string; 
    orderNumber?: string; 
  };
  const chatId = orderId || tripId || ''; // Use orderId if available, fallback to tripId
  const displayNumber = orderNumber || tripNumber || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Normalize message format from API or socket
  const normalizeMessage = (message: any): ChatMessage => {
    return {
      _id: message._id || message.id || '',
      tripId: message.tripId || message.orderId || chatId,
      senderId: {
        _id: message.senderId?._id || message.senderId || message.sender?._id || '',
        name: message.senderId?.name || message.sender?.name || message.senderName || '',
        email: message.senderId?.email || message.sender?.email || '',
      },
      senderType: message.senderType || 'driver',
      senderName: message.senderName || message.senderId?.name || message.sender?.name || '',
      message: message.message || '',
      fileUrl: message.fileUrl || null,
      fileName: message.fileName || null,
      fileType: message.fileType || null,
      fileSize: message.fileSize || null,
      readBy: message.readBy || [],
      createdAt: message.createdAt || new Date().toISOString(),
      updatedAt: message.updatedAt || new Date().toISOString(),
    };
  };

  // Load messages
  const loadMessages = async () => {
    try {
      setLoading(true);
      logger.info('Loading messages for trip/order', { tripId: chatId });
      const response = await chatService.getTripChatMessages(chatId, 1, 100);
      
      logger.info('Messages API response', { 
        success: response.success,
        hasData: !!response.data,
        responseKeys: response.data ? Object.keys(response.data) : [],
        messagesCount: response.data?.messages?.length || response.data?.data?.messages?.length || 0
      });
      
      // Handle nested response structure (apiService wraps backend response)
      let messagesArray: any[] = [];
      if (response.success && response.data) {
        // Check if data is nested (apiService wraps it)
        if (response.data.data && response.data.data.messages) {
          messagesArray = response.data.data.messages;
        } else if (response.data.messages) {
          messagesArray = response.data.messages;
        } else if (Array.isArray(response.data)) {
          messagesArray = response.data;
        }
      }
      
      if (messagesArray.length > 0) {
        // Normalize all messages from API
        const normalizedMessages = messagesArray.map((msg: any) => normalizeMessage(msg));
        
        logger.info('Normalized messages', { 
          count: normalizedMessages.length,
          firstMessage: normalizedMessages[0] ? {
            id: normalizedMessages[0]._id,
            senderId: normalizedMessages[0].senderId._id,
            senderName: normalizedMessages[0].senderName,
            message: normalizedMessages[0].message?.substring(0, 20) || 'no message',
            hasFile: !!normalizedMessages[0].fileUrl
          } : null
        });
        
        setMessages(normalizedMessages);
        scrollToBottom();
      } else {
        logger.warn('No messages found in response', { 
          responseStructure: {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            dataType: typeof response.data
          }
        });
        setMessages([]);
      }
    } catch (error: any) {
      logger.error('Error loading messages', error);
      console.error('Full error details:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Initialize socket and load messages
  useEffect(() => {
    // Set up socket listeners FIRST (before joining room) to catch messages immediately
    const handleNewMessage = (message: any) => {
      try {
        // Normalize message format from socket
        const normalizedMessage = normalizeMessage(message);

        logger.info('📨 Received new chat message via socket', { 
          messageId: normalizedMessage._id,
          orderId: normalizedMessage.orderId,
          tripId: normalizedMessage.tripId,
          chatId: chatId,
          senderId: normalizedMessage.senderId._id,
          senderName: normalizedMessage.senderName,
          senderType: normalizedMessage.senderType,
          currentUserId: currentUserIdRef.current,
          hasFile: !!normalizedMessage.fileUrl
        });

        // Filter: Only process messages for this chat (orderId or tripId must match chatId)
        const messageOrderId = normalizedMessage.orderId?.toString() || normalizedMessage.orderId;
        const messageTripId = normalizedMessage.tripId?.toString() || normalizedMessage.tripId;
        const currentChatId = chatId?.toString() || chatId;
        
        if (messageOrderId !== currentChatId && messageTripId !== currentChatId) {
          logger.info('⚠️ Ignoring message from different chat', {
            messageOrderId,
            messageTripId,
            currentChatId
          });
          return; // Ignore messages from other chats
        }

        logger.info('✅ Message belongs to current chat, adding to state');

        // Check if message already exists or replace optimistic message
        setMessages((prev) => {
          // Check if this is replacing an optimistic message (same content, different ID)
          const optimisticIndex = prev.findIndex(
            (msg) => msg._id.startsWith('temp-') && 
                     msg.message === normalizedMessage.message &&
                     msg.tripId === normalizedMessage.tripId
          );
          
          if (optimisticIndex !== -1) {
            // Replace optimistic message with real one
            const newMessages = [...prev];
            newMessages[optimisticIndex] = normalizedMessage;
            logger.info('Replaced optimistic message with real message', { 
              optimisticId: prev[optimisticIndex]._id,
              realId: normalizedMessage._id
            });
            return newMessages;
          }
          
          // Check if message already exists (avoid duplicates)
          const exists = prev.some((msg) => msg._id === normalizedMessage._id);
          if (exists) {
            logger.warn('⚠️ Message already exists, skipping', { messageId: normalizedMessage._id });
            return prev;
          }
          
          logger.info('✅ Adding new message to state', {
            messageId: normalizedMessage._id,
            senderId: normalizedMessage.senderId._id,
            currentUserId: currentUserIdRef.current,
            isOwn: String(normalizedMessage.senderId._id) === String(currentUserIdRef.current),
            messageCount: prev.length + 1
          });
          
          return [...prev, normalizedMessage];
        });
        
        // Scroll to bottom after a brief delay to ensure UI update
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        
        // Mark as read if it's not from current user
        const senderId = normalizedMessage.senderId._id || normalizedMessage.senderId;
        if (senderId !== currentUserIdRef.current) {
          chatService.markMessagesAsRead(chatId);
        }
      } catch (error) {
        logger.error('Error handling new message', error);
      }
    };

    // Listen for typing indicators
    const handleTyping = (data: {
      userId: string;
      userName: string;
      tripId: string;
      isTyping: boolean;
    }) => {
      if ((data.tripId === chatId || data.tripId === tripId) && data.userId !== currentUserIdRef.current) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.userName);
          } else {
            newSet.delete(data.userName);
          }
          return newSet;
        });
      }
    };

    // Set up listeners BEFORE initializing chat
    socketService.onNewChatMessage(handleNewMessage);
    socketService.onUserTyping(handleTyping);
    logger.info('✅ Socket listeners set up for chat', { chatId });

    const initializeChat = async () => {
      try {
        // Get token and user ID
        let token = await AsyncStorage.getItem('auth_token');
        
        // Try to get user ID from multiple sources
        let userId = await AsyncStorage.getItem('user_id');
        if (!userId) {
          const userData = await AsyncStorage.getItem('user_data');
          if (userData) {
            try {
              const parsed = JSON.parse(userData);
              userId = parsed.id || parsed._id || parsed.userId || null;
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }

        if (!token) {
          Alert.alert('Error', 'Please login to use chat');
          navigation.goBack();
          return;
        }

        // Clean token - remove "Bearer " prefix if present
        token = token.trim();
        if (token.startsWith('Bearer ')) {
          token = token.substring(7).trim();
        }

        // Ensure socket is connected
        if (!socketService.isSocketConnected()) {
          await socketService.initialize();
        }

        // Set user ID if we have it
        if (userId) {
          currentUserIdRef.current = userId;
          logger.info('User ID set from storage', { userId });
        }
        
        // Authenticate socket for chat
        await socketService.authenticateChat(token);

        // Join trip/order chat room (tripId is actually orderId now)
        await socketService.joinTripChat(chatId);
        logger.info('✅ Joined chat room', { chatId });

        // Load messages
        await loadMessages();

        // Mark messages as read
        await chatService.markMessagesAsRead(chatId);
      } catch (error: any) {
        logger.error('Error initializing chat', error);
        Alert.alert('Error', error.message || 'Failed to initialize chat');
      }
    };

    initializeChat();

    // Cleanup
    return () => {
      logger.info('🧹 Cleaning up socket listeners', { chatId });
      socketService.offNewChatMessage(handleNewMessage);
      socketService.offUserTyping(handleTyping);
      socketService.leaveTripChat(chatId);
    };
  }, [chatId]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    try {
      setSending(true);

      // If file is selected, use HTTP API
      if (selectedFile) {
        const response = await chatService.sendChatMessage(
          chatId,
          newMessage,
          selectedFile.uri,
          selectedFile.name,
          selectedFile.mimeType
        );
        if (response.success && response.data) {
          setMessages((prev) => [...prev, response.data!]);
          setNewMessage('');
          setSelectedFile(null);
          scrollToBottom();
        }
      } else {
        // Send via socket for real-time
        // Create optimistic message for immediate UI update
        const optimisticMessage: ChatMessage = {
          _id: `temp-${Date.now()}`,
          tripId: chatId,
          senderId: {
            _id: currentUserIdRef.current || '',
            name: '',
            email: '',
          },
          senderType: 'driver',
          senderName: '',
          message: newMessage,
          readBy: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add optimistic message immediately
        setMessages((prev) => [...prev, optimisticMessage]);
        setNewMessage('');
        scrollToBottom();

        // Send via socket (tripId is actually orderId now, backend will handle it)
        socketService.sendChatMessage({
          tripId: chatId,
          orderId: chatId, // Also send orderId for clarity
          message: newMessage,
        });

        logger.info('Message sent via socket', { tripId, message: newMessage });
      }
    } catch (error: any) {
      logger.error('Error sending message', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // Check file size (max 10MB)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 10MB');
          return;
        }
        setSelectedFile(file);
      }
    } catch (error: any) {
      logger.error('Error selecting file', error);
      Alert.alert('Error', 'Failed to select file');
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    socketService.setTyping(tripId, true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socketService.setTyping(tripId, false);
    }, 2000);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const currentUserId = currentUserIdRef.current;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Chat</Text>
            <Text style={styles.headerSubtitle}>{displayNumber}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : (
            messages.map((message, index) => {
              // Handle different senderId formats
              const senderId = message.senderId?._id || message.senderId || '';
              const currentUserId = currentUserIdRef.current || '';
              const isOwn = String(senderId) === String(currentUserId);
              
              // Debug log for first message
              if (index === 0) {
                logger.info('Rendering first message', {
                  messageId: message._id,
                  senderId: senderId,
                  currentUserId: currentUserId,
                  isOwn,
                  hasMessage: !!message.message,
                  hasFile: !!message.fileUrl,
                  senderName: message.senderName
                });
              }
              return (
                <View
                  key={message._id}
                  style={[styles.messageContainer, isOwn ? styles.messageOwn : styles.messageOther]}
                >
                  {!isOwn && (
                    <Text style={styles.senderName}>{message.senderName}</Text>
                  )}
                  {message.message && (
                    <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                      {message.message}
                    </Text>
                  )}
                  {message.fileUrl && (
                    <TouchableOpacity
                      style={styles.fileContainer}
                      onPress={async () => {
                        try {
                          console.log('📄 ===== OPENING DOCUMENT (Mobile App) =====');
                          console.log('📄 Message ID:', message._id);
                          console.log('📄 File Name:', message.fileName);
                          console.log('📄 File Type:', message.fileType);
                          console.log('📄 File Size:', message.fileSize);
                          console.log('📄 Original fileUrl (full):', message.fileUrl);
                          console.log('📄 File URL length:', message.fileUrl?.length || 0);
                          
                          logger.info('Opening chat file', { 
                            messageId: message._id,
                            fileName: message.fileName,
                            fileUrl: message.fileUrl,
                            fileType: message.fileType,
                            fileSize: message.fileSize
                          });
                          
                          // Get signed URL first
                          console.log('📄 Attempting to get signed URL for message:', message._id);
                          const response = await chatService.getChatMessageFileSignedUrl(message._id, 'inline');
                          
                          console.log('📄 Signed URL response:', {
                            success: response.success,
                            hasUrl: !!response.url,
                            urlLength: response.url?.length || 0,
                            urlPreview: response.url?.substring(0, 100) || 'N/A'
                          });
                          
                          logger.info('Signed URL response', { 
                            success: response.success,
                            hasUrl: !!response.url,
                            urlLength: response.url?.length || 0
                          });
                          
                          if (response.success && response.url) {
                            console.log('📄 Using signed URL:', response.url);
                            logger.info('Opening signed URL');
                            const canOpen = await Linking.canOpenURL(response.url);
                            console.log('📄 Can open signed URL?', canOpen);
                            if (canOpen) {
                              await Linking.openURL(response.url);
                              console.log('📄 ✅ Successfully opened signed URL');
                            } else {
                              console.log('📄 ⚠️ Cannot open signed URL, trying fallback original URL');
                              logger.warn('Cannot open URL, trying fallback');
                              if (message.fileUrl) {
                                console.log('📄 Opening fallback original URL:', message.fileUrl);
                                await Linking.openURL(message.fileUrl);
                                console.log('📄 ✅ Successfully opened original URL (fallback)');
                              } else {
                                console.log('📄 ❌ No original URL available');
                                Alert.alert('Error', 'Unable to open file URL.');
                              }
                            }
                          } else {
                            console.log('📄 ⚠️ Signed URL failed, using original URL');
                            logger.warn('Signed URL failed, using fallback', { 
                              responseSuccess: response.success,
                              hasUrl: !!response.url,
                              originalUrl: !!message.fileUrl
                            });
                            // Fallback to original URL
                            if (message.fileUrl) {
                              console.log('📄 Attempting to open original URL:', message.fileUrl);
                              const canOpen = await Linking.canOpenURL(message.fileUrl);
                              console.log('📄 Can open original URL?', canOpen);
                              if (canOpen) {
                                await Linking.openURL(message.fileUrl);
                                console.log('📄 ✅ Successfully opened original URL');
                              } else {
                                console.log('📄 ❌ Cannot open original URL - URL may be invalid');
                                Alert.alert('Error', `Unable to open file. URL: ${message.fileUrl.substring(0, 50)}...`);
                              }
                            } else {
                              console.log('📄 ❌ No fileUrl available');
                              Alert.alert('Error', 'Unable to get file URL.');
                            }
                          }
                        } catch (error: any) {
                          console.log('📄 ❌ Error opening file:', error.message);
                          console.log('📄 Error stack:', error.stack);
                          console.log('📄 Error details:', JSON.stringify(error, null, 2));
                          logger.error('Error opening file', error);
                          console.error('Error opening file:', error);
                          const errorMessage = error?.message || 'Unknown error';
                          // Fallback to original URL
                          if (message.fileUrl) {
                            console.log('📄 Attempting final fallback to original URL:', message.fileUrl);
                            Linking.openURL(message.fileUrl).catch((linkError) => {
                              console.log('📄 ❌ Failed to open URL even as fallback:', linkError.message);
                              Alert.alert('Error', `Unable to open file: ${errorMessage}`);
                            });
                          } else {
                            Alert.alert('Error', `Unable to open file: ${errorMessage}`);
                          }
                        }
                        console.log('📄 ==========================================');
                      }}
                    >
                      <Ionicons
                        name={message.fileType === 'image' ? 'image' : 'document'}
                        size={20}
                        color={isOwn ? '#ffffff' : '#2563eb'}
                      />
                      <Text style={[styles.fileName, isOwn && styles.fileNameOwn]}>
                        {message.fileName || 'File'}
                      </Text>
                      {message.fileSize && (
                        <Text style={[styles.fileSize, isOwn && styles.fileSizeOwn]}>
                          ({formatFileSize(message.fileSize)})
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                    {formatDate(message.createdAt)}
                  </Text>
                </View>
              );
            })
          )}

          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <View style={[styles.messageContainer, styles.messageOther]}>
              <Text style={styles.typingText}>
                {Array.from(typingUsers).join(', ')} typing...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* File preview */}
        {selectedFile && (
          <View style={styles.filePreview}>
            <Ionicons name="document" size={20} color="#374151" />
            <Text style={styles.filePreviewText} numberOfLines={1}>
              {selectedFile.name}
            </Text>
            <Text style={styles.filePreviewSize}>
              {selectedFile.size ? formatFileSize(selectedFile.size) : ''}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedFile(null)}
              style={styles.removeFileButton}
            >
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            onPress={handleFileSelect}
            style={styles.attachButton}
          >
            <Ionicons name="attach" size={24} color="#6b7280" />
          </TouchableOpacity>
          <TextInput
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text);
              handleTyping();
            }}
            placeholder="Type a message..."
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sending || (!newMessage.trim() && !selectedFile)}
            style={[
              styles.sendButton,
              (sending || (!newMessage.trim() && !selectedFile)) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#9ca3af',
  },
  messageContainer: {
    maxWidth: '75%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
  },
  messageTextOwn: {
    color: '#ffffff',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  fileNameOwn: {
    color: '#ffffff',
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  fileSizeOwn: {
    color: '#e5e7eb',
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  messageTimeOwn: {
    color: '#e5e7eb',
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  filePreviewText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  filePreviewSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  removeFileButton: {
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
});

export default TripChatScreen;

