import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { chatService, ChatMessage } from '../../services/api/chatService';
import { socketService } from '../../services/socket/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/loggerHelper';
import { authManager } from '../../types/AuthManager';
import { apiService } from '../../services/api/apiService';
import { useRNWebRTC } from '../../hooks/useWebRTC';
// ─── Global Theme ─────────────────────────────────────────────────────────────
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';
const DriverChatScreen = () => {
  const navigation = useNavigation();
  const currentUser = authManager.getCurrentUser();
  const driverId = currentUser?.id || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const [callState, setCallState] = useState<"idle" | "incoming" | "connected">("idle");
const [incomingCall, setIncomingCall] = useState<any>(null);
const {
  handleIncomingCall,
  handleAnswer,
  handleICE,
  endCall
} = useRNWebRTC();

  // Normalize message format from API or socket
  const normalizeMessage = (message: any): ChatMessage => {
    return {
      _id: message._id || message.id || '',
      driverId: message.driverId || driverId,
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
    if (!driverId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      logger.info('Loading driver chat messages', { driverId });
      const response = await chatService.getDriverChatMessages(driverId, 1, 100);

      logger.info('Driver chat messages API response', {
        success: response.success,
        hasData: !!response.data,
        messagesCount: response.data?.messages?.length || response.data?.data?.messages?.length || 0
      });

      // Handle nested response structure
      let messagesArray: any[] = [];
      if (response.success && response.data) {
        if (response.data.data && response.data.data.messages) {
          messagesArray = response.data.data.messages;
        } else if (response.data.messages) {
          messagesArray = response.data.messages;
        } else if (Array.isArray(response.data)) {
          messagesArray = response.data;
        }
      }

      if (messagesArray.length > 0) {
        const normalizedMessages = messagesArray.map((msg: any) => normalizeMessage(msg));
        setMessages(normalizedMessages);
        scrollToBottom();
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      logger.error('Error loading driver chat messages', error);
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

  // Get current user ID
  useEffect(() => {
    const getUser = async () => {
      const user = authManager.getCurrentUser();
      if (user?.id) {
        currentUserIdRef.current = user.id;
      } else {
        const storedId = await AsyncStorage.getItem('userId');
        currentUserIdRef.current = storedId;
      }
    };
    getUser();
  }, []);

  // Initialize socket and load messages
  useEffect(() => {
    if (!driverId) return;

    // Define handlers outside async function so they can be cleaned up
    const handleNewMessage = (message: any) => {
      // Skip system messages with trip status - these are only for dispatchers
      if (message.isSystemMessage || message.senderType === 'system' || message.forDispatchersOnly) {
        logger.info('Skipping system message (trip status) - only for dispatchers');
        return;
      }

      // Normalize driverId from message (handle both object and string formats)
      let messageDriverId: string = '';
      if (message.driverId) {
        if (typeof message.driverId === 'object') {
          messageDriverId = message.driverId._id?.toString() || message.driverId.toString() || '';
        } else {
          messageDriverId = String(message.driverId);
        }
      }

      // Normalize current driverId for comparison
      const currentDriverIdStr = String(driverId);

      logger.info('New message received in mobile chat', {
        messageDriverId,
        currentDriverId: currentDriverIdStr,
        match: messageDriverId === currentDriverIdStr,
        senderId: message.senderId?._id || message.senderId,
        messagePreview: message.message?.substring(0, 50)
      });

      // Only process messages with driverId matching current driver
      if (messageDriverId === currentDriverIdStr) {
        const normalized = normalizeMessage(message);

        // Check if message already exists to avoid duplicates
        setMessages((prev) => {
          const exists = prev.some(msg => msg._id === normalized._id);
          if (exists) {
            logger.info('Message already exists, skipping duplicate');
            return prev;
          }

          // Check if this is a real message that should replace an optimistic message
          const senderId = normalized.senderId._id || '';
          const currentUserId = currentUserIdRef.current || '';

          if (senderId === currentUserId) {
            // Remove optimistic messages from current user
            const filtered = prev.filter(msg => {
              if (msg._id.startsWith('temp-') && msg.senderId._id === currentUserId) {
                logger.info('Removing optimistic message:', msg._id);
                return false;
              }
              return true;
            });
            return [...filtered, normalized];
          } else {
            return [...prev, normalized];
          }
        });

        scrollToBottom();

        // Mark as read if it's not from current user
        const senderId = message.senderId?._id || message.senderId || '';
        if (senderId !== currentUserIdRef.current) {
          chatService.markDriverMessagesAsRead(driverId);
        }
      } else {
        logger.warn('Message driverId does not match current driver', {
          messageDriverId,
          currentDriverId: currentDriverIdStr
        });
      }
    };

    const handleTyping = (data: {
      userId: string;
      userName: string;
      driverId?: string;
      tripId?: string;
      orderId?: string;
      isTyping: boolean;
    }) => {
      // Only handle driver chat typing indicators (has driverId and matches current driver)
      if (data.driverId && data.driverId === driverId) {
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

    const initializeChat = async () => {
      try {
        // Get token using apiService (which uses 'auth_token' key)
        const token = await apiService.getStoredToken();
        if (!token) {
          logger.warn('No token found for socket authentication');
          // Still try to load messages even without socket
          loadMessages();
          return;
        }

        // Initialize socket if not connected
        if (!socketService.isSocketConnected()) {
          logger.info('Initializing socket connection');
          await socketService.initialize();
        }

        // Always authenticate socket for chat (even if already connected)
        // This ensures socketUser is set on the backend
        logger.info('Authenticating socket for chat');
        try {
          await socketService.authenticateChat(token);
          logger.info('Socket authenticated successfully');
        } catch (authError: any) {
          logger.error('Socket authentication failed', authError);
          throw new Error(`Authentication failed: ${authError.message}`);
        }

        // Set up listeners (safe to register even before socket fully connected)
        socketService.onNewChatMessage(handleNewMessage);
        socketService.onUserTyping(handleTyping);

        // Wait a bit to ensure authentication is fully processed on backend
        // This gives the backend time to set socketUser
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Join driver chat room
        logger.info('Joining driver chat room', { driverId });
        try {
          await socketService.joinDriverChat(driverId);
          logger.info('Successfully joined driver chat room');
        } catch (joinError: any) {
          logger.error('Failed to join driver chat room', joinError);
          // If join fails due to authentication, try re-authenticating
          if (joinError.message?.includes('authenticate') || joinError.message?.includes('Please authenticate')) {
            logger.info('Re-authenticating socket and retrying join');
            await socketService.authenticateChat(token);
            await new Promise(resolve => setTimeout(resolve, 500));
            await socketService.joinDriverChat(driverId);
            logger.info('Successfully joined driver chat room after re-authentication');
          } else {
            throw joinError;
          }
        }

        // Load messages
        await loadMessages();

        // Mark messages as read
        await chatService.markDriverMessagesAsRead(driverId);
      } catch (error: any) {
        logger.error('Error initializing driver chat', error);
        // Still try to load messages even if socket fails
        loadMessages();
      }
    };

    initializeChat();

    // Cleanup
    return () => {
      socketService.offNewChatMessage(handleNewMessage);
      socketService.offUserTyping(handleTyping);
      // Do NOT call leaveDriverChat here — MainTabNavigator keeps the socket
      // in the driver chat room for global dispatcher message notifications.
    };
  }, [driverId]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;
    if (!driverId) return;

    const messageText = newMessage.trim();
    const fileToSend = selectedFile;

    try {
      setSending(true);

      // If file is selected, use HTTP API
      if (fileToSend) {
        const response = await chatService.sendDriverChatMessage(
          driverId,
          messageText,
          fileToSend.uri,
          fileToSend.name,
          fileToSend.mimeType
        );
        if (response.success && response.data) {
          setMessages((prev) => [...prev, normalizeMessage(response.data!)]);
          setNewMessage('');
          setSelectedFile(null);
          scrollToBottom();
        }
      } else {
        // Create optimistic message for immediate display
        const currentUser = authManager.getCurrentUser();
        const optimisticMessage: ChatMessage = {
          _id: `temp-${Date.now()}-${Math.random()}`,
          driverId: driverId,
          senderId: {
            _id: currentUser?.id || currentUserIdRef.current || '',
            name: currentUser?.name || 'You',
            email: currentUser?.email || '',
          },
          senderType: 'driver',
          senderName: currentUser?.name || 'You',
          message: messageText,
          fileUrl: null,
          fileName: null,
          fileType: null,
          fileSize: null,
          readBy: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add optimistic message immediately for instant feedback
        setMessages((prev) => [...prev, optimisticMessage]);
        setNewMessage('');
        scrollToBottom();

        // Send via socket for real-time
        // The backend will emit the message back via socket, which will be caught by handleNewMessage
        // The real message will replace the optimistic one
        socketService.sendDriverChatMessage({
          driverId,
          message: messageText,
        });
      }
    } catch (error: any) {
      logger.error('Error sending driver chat message', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Remove optimistic message on error
      if (!fileToSend) {
        setMessages((prev) => prev.filter(msg => !msg._id.startsWith('temp-')));
      }
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
    if (!driverId) return;
    socketService.setDriverTyping(driverId, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.setDriverTyping(driverId, false);
    }, 2000);
  };

  // Format time for message
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Format date label for date separators
  const formatDateLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Check if date separator should be shown between two messages
  const shouldShowDateSeparator = (current: ChatMessage, previous?: ChatMessage): boolean => {
    if (!previous) return true;
    const a = new Date(current.createdAt);
    const b = new Date(previous.createdAt);
    return (
      a.getDate() !== b.getDate() ||
      a.getMonth() !== b.getMonth() ||
      a.getFullYear() !== b.getFullYear()
    );
  };

  // Get tick status for sent messages
  const getTickIcon = (message: ChatMessage): { name: any; color: string } | null => {
    if (message.senderType !== 'driver') return null;
    const isOptimistic = message._id.startsWith('temp-');
    if (isOptimistic) return { name: 'time-outline', color: 'rgba(255,255,255,0.6)' };
    const isRead = message.readBy && message.readBy.length > 0;
    return {
      name: isRead ? 'checkmark-done' : 'checkmark-done',
      color: isRead ? '#A5F3FC' : 'rgba(255,255,255,0.6)',
    };
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  // Open file
  const handleOpenFile = async (fileUrl: string, messageId: string) => {
    try {
      const response = await chatService.getChatMessageFileSignedUrl(messageId, 'inline');
      if (response.success && response.url) {
        await Linking.openURL(response.url);
      } else {
        await Linking.openURL(fileUrl);
      }
    } catch (error: any) {
      logger.error('Error opening file', error);
      await Linking.openURL(fileUrl);
    }
  };

  const currentUserId = currentUserIdRef.current;

  useEffect(() => {
  const socket = socketService.getSocket();
  if (!socket) return;

  const onIncoming = ({ from, offer }: any) => {
    console.log("📞 Incoming call");

    setIncomingCall({ from, offer });
    setCallState("incoming");
  };

  const onAnswer = ({ answer }: any) => {
    console.log("📞 Answer received");
    handleAnswer(answer);
    setCallState("connected");
  };

  const onIce = ({ candidate }: any) => {
    console.log("🧊 ICE received");
    handleICE(candidate);
  };

  socket.on("incoming-call", onIncoming);
  socket.on("call-answered", onAnswer);
  socket.on("call-ice", onIce);

  return () => {
    socket.off("incoming-call", onIncoming);
    socket.off("call-answered", onAnswer);
    socket.off("call-ice", onIce);
  };
}, []);


const acceptCall = async () => {
  if (!incomingCall) return;

  await handleIncomingCall(incomingCall.offer, incomingCall.from);
  setCallState("connected");
};

const rejectCall = () => {
  setIncomingCall(null);
  setCallState("idle");

  socketService.getSocket()?.emit("call-rejected", {
    to: incomingCall?.from
  });
};

const handleEndCall = () => {
  endCall();
  setCallState("idle");
  setIncomingCall(null);
};

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>D</Text>
              <View style={styles.headerOnlineDot} />
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Dispatcher</Text>
              <View style={styles.headerStatusRow}>
                <View style={styles.headerOnlineDotInline} />
                <Text style={styles.headerSubtitle}>Online</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Messages Container */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollToBottom()}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accentNavyBlue} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={COLORS.accentNavyBlue} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation with your dispatcher!</Text>
            </View>
          ) : (
            messages.map((message, index) => {
              const isRightSide = message.senderType === 'driver';
              const prevMessage = index > 0 ? messages[index - 1] : undefined;
              const showAvatar = !prevMessage || prevMessage.senderId._id !== message.senderId._id;
              const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId._id !== message.senderId._id;
              const showDateSep = shouldShowDateSeparator(message, prevMessage);
              const tick = getTickIcon(message);

              return (
                <React.Fragment key={message._id}>
                  {/* Date Separator */}
                  {showDateSep && (
                    <View style={styles.dateSeparator}>
                      <View style={styles.dateSeparatorLine} />
                      <Text style={styles.dateSeparatorText}>{formatDateLabel(message.createdAt)}</Text>
                      <View style={styles.dateSeparatorLine} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageWrapper,
                      isRightSide ? styles.messageWrapperRight : styles.messageWrapperLeft,
                      !isLastInGroup && { marginBottom: 2 },
                    ]}
                  >
                    {!isRightSide && showAvatar && (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(message.senderName || 'D').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {!isRightSide && !showAvatar && <View style={styles.avatarPlaceholder} />}

                    <View
                      style={[
                        styles.messageBubble,
                        isRightSide ? styles.messageBubbleRight : styles.messageBubbleLeft,
                        isRightSide && isLastInGroup && styles.bubbleTailRight,
                        !isRightSide && isLastInGroup && styles.bubbleTailLeft,
                      ]}
                    >
                      {!isRightSide && showAvatar && (
                        <Text style={styles.senderName}>{message.senderName}</Text>
                      )}

                      {message.message ? (
                        <Text
                          style={[
                            styles.messageText,
                            isRightSide ? styles.messageTextRight : styles.messageTextLeft,
                          ]}
                        >
                          {message.message}
                        </Text>
                      ) : null}

                      {message.fileUrl && (
                        <TouchableOpacity
                          onPress={() => handleOpenFile(message.fileUrl!, message._id)}
                          style={[
                            styles.fileButton,
                            isRightSide ? styles.fileButtonRight : styles.fileButtonLeft,
                          ]}
                        >
                          <Ionicons
                            name={message.fileType === 'image' ? 'image' : 'document'}
                            size={20}
                            color={isRightSide ? '#fff' : '#8B5CF6'}
                          />
                          <Text
                            style={[
                              styles.fileName,
                              isRightSide ? styles.fileNameRight : styles.fileNameLeft,
                            ]}
                          >
                            {message.fileName || 'File'}
                          </Text>
                          {message.fileSize && (
                            <Text
                              style={[
                                styles.fileSize,
                                isRightSide ? styles.fileSizeRight : styles.fileSizeLeft,
                              ]}
                            >
                              {formatFileSize(message.fileSize)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* Time + Ticks row */}
                      <View style={[styles.messageFooter, isRightSide && styles.messageFooterRight]}>
                        <Text
                          style={[
                            styles.messageTime,
                            isRightSide ? styles.messageTimeRight : styles.messageTimeLeft,
                          ]}
                        >
                          {formatTime(message.createdAt)}
                        </Text>
                        {tick && (
                          <Ionicons
                            name={tick.name}
                            size={14}
                            color={tick.color}
                            style={styles.tickIcon}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}

          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <View style={[styles.messageWrapper, styles.messageWrapperLeft]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>D</Text>
              </View>
              <View style={[styles.messageBubble, styles.messageBubbleLeft]}>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={[styles.typingDot, { animationDelay: '150ms' }]} />
                  <View style={[styles.typingDot, { animationDelay: '300ms' }]} />
                </View>
                <Text style={styles.typingText}>
                  {Array.from(typingUsers).join(', ')} typing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* File Preview */}
        {selectedFile && (
          <View style={styles.filePreview}>
            <View style={styles.filePreviewContent}>
              <Ionicons name="document" size={24} color="#8B5CF6" />
              <View style={styles.filePreviewInfo}>
                <Text style={styles.filePreviewName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                {selectedFile.size && (
                  <Text style={styles.filePreviewSize}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedFile(null)}
              style={styles.filePreviewClose}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            onPress={handleFileSelect}
            style={styles.attachButton}
          >
            <Ionicons name="attach" size={24} color="#8B5CF6" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text);
              handleTyping();
            }}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {callState === "incoming" && (
  <View style={styles.callOverlay}>
    <Text style={styles.callText}>Incoming Call</Text>

    <View style={{ flexDirection: "row", gap: 20 }}>
      <TouchableOpacity onPress={acceptCall} style={styles.acceptBtn}>
        <Text style={{ color: "#fff" }}>Accept</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={rejectCall} style={styles.rejectBtn}>
        <Text style={{ color: "#fff" }}>Reject</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

{callState === "connected" && (
  <View style={styles.callOverlay}>
    <Text style={styles.callText}>Call Connected</Text>

    <TouchableOpacity onPress={handleEndCall} style={styles.rejectBtn}>
      <Text style={{ color: "#fff" }}>End Call</Text>
    </TouchableOpacity>
  </View>
)}
    </SafeAreaView>
    
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.accentNavyBlue,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  header: {
    backgroundColor: COLORS.accentNavyBlue,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: COLORS.accentNavyBlue,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerOnlineDotInline: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 8,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.5,
  },
  dateSeparatorText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: COLORS.accentBlue,
    fontWeight: '600',
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageWrapperLeft: {
    justifyContent: 'flex-start',
  },
  messageWrapperRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accentNavyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 34,
    marginRight: 6,
  },
  avatarText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  messageBubbleLeft: {
    backgroundColor: COLORS.bgCardLight,
    borderBottomLeftRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  messageBubbleRight: {
    backgroundColor: COLORS.accentNavyBlue,
    borderBottomRightRadius: 18,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleTailLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleTailRight: {
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accentNavyBlue,
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextLeft: {
    color: COLORS.textPrimary,
  },
  messageTextRight: {
    color: COLORS.textPrimary,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 8,
    borderRadius: 10,
  },
  fileButtonLeft: {
    backgroundColor: COLORS.accentNavyBlue,
  },
  fileButtonRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  fileName: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  fileNameLeft: {
    color: COLORS.textPrimary,
  },
  fileNameRight: {
    color: '#fff',
  },
  fileSize: {
    fontSize: 11,
    marginLeft: 6,
  },
  fileSizeLeft: {
    color: '#6B7280',
  },
  fileSizeRight: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageFooterRight: {
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeLeft: {
    color: '#9CA3AF',
  },
  messageTimeRight: {
    color: 'rgba(255,255,255,0.65)',
  },
  tickIcon: {
    marginLeft: 3,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
    marginRight: 4,
  },
  typingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.bgCardLight,
    borderTopWidth: 1,
    borderTopColor: '#DDD6FE',
  },
  filePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filePreviewInfo: {
    marginLeft: 10,
    flex: 1,
  },
  filePreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  filePreviewSize: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  filePreviewClose: {
    marginLeft: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bgCardLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  attachButton: {
    marginRight: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bgCard,
    borderRadius: 22,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentNavyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.45,
    elevation: 0,
  },
  callOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.9)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
},

callText: {
  color: "#fff",
  fontSize: 20,
  marginBottom: 20,
},

acceptBtn: {
  backgroundColor: "green",
  padding: 15,
  borderRadius: 50,
},

rejectBtn: {
  backgroundColor: "red",
  padding: 15,
  borderRadius: 50,
},
});

export default DriverChatScreen;

