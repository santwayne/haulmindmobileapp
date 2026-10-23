// src/screens/notifications/index.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import apiService from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Notification {
    _id: string;
    id?: string;
    action: string;
    changeSummary: string;
    createdAt: string;
    isRead?: boolean;
    type?: string;
    priority?: 'high' | 'medium' | 'low';
    icon?: string;
    color?: string;
}

export default function NotificationsScreen({ }) {
    const navigation = useNavigation<NavigationProp>();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, high

    // Fetch notifications from API
    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await apiService.getNotifications();
            console.log('📦 Notifications API Response:', JSON.stringify(response, null, 2));

            // Handle nested response structure: response.data.data.notifications
            const notificationsData = response.data?.data?.notifications || response.data?.notifications || [];

            if (response.success && notificationsData.length >= 0) {
                // Transform API response to match our notification format
                const formattedNotifications = notificationsData.map((notif: any) => {
                    // Determine notification type and styling based on action
                    let type = 'system';
                    let icon = 'information-circle-outline';
                    let color = '#6366F1';
                    let priority: 'high' | 'medium' | 'low' = 'medium';

                    if (notif.action?.toLowerCase().includes('completed')) {
                        type = 'task_completed';
                        icon = 'checkmark-circle-outline';
                        color = '#10B981';
                        priority = 'high';
                    } else if (notif.action?.toLowerCase().includes('delivered')) {
                        type = 'task_delivered';
                        icon = 'location-outline';
                        color = '#F59E0B';
                        priority = 'high';
                    } else if (notif.action?.toLowerCase().includes('started')) {
                        type = 'task_assigned';
                        icon = 'play-circle-outline';
                        color = '#906AD1';
                        priority = 'high';
                    } else if (notif.action?.toLowerCase().includes('assigned') || notif.action?.toLowerCase().includes('order assigned')) {
                        type = 'order_assigned';
                        icon = 'notifications';
                        color = '#2563eb';
                        priority = 'high';
                    }

                    return {
                        _id: notif._id,
                        id: notif._id,
                        action: notif.action || 'Notification',
                        changeSummary: notif.changeSummary || '',
                        createdAt: notif.createdAt || new Date().toISOString(),
                        isRead: false, // ActivityLog doesn't have read status, so we'll consider all as unread initially
                        type,
                        icon,
                        color,
                        priority
                    };
                });
                console.log('✅ Formatted notifications:', formattedNotifications.length);
                setNotifications(formattedNotifications);
            } else {
                logger.warn('Failed to fetch notifications', { response });
                console.log('⚠️ No notifications found or invalid response structure');
                setNotifications([]);
            }
        } catch (error) {
            logger.error('Error fetching notifications', error);
            Alert.alert('Error', 'Failed to load notifications. Please try again.');
            setNotifications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch notifications when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchNotifications();
        }, [])
    );

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Refresh notifications
    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
    };

    // Mark notification as read
    const markAsRead = (id: string) => {
        const notification = notifications.find(n => n._id === id || n.id === id);

        // Only mark as read if it's not already read
        if (notification && !notification.isRead) {
            setNotifications(prev =>
                prev.map(notif =>
                    notif._id === id || notif.id === id
                        ? { ...notif, isRead: true }
                        : notif
                )
            );

            // Optional: Show brief feedback (you can remove this if you don't want it)
            // The visual change (removing unread indicator) already provides feedback
        }
    };

    // Mark all as read
    const markAllAsRead = () => {
        Alert.alert(
            'Mark All as Read',
            'Are you sure you want to mark all notifications as read?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark All',
                    onPress: () => {
                        setNotifications(prev =>
                            prev.map(notification => ({ ...notification, isRead: true }))
                        );
                    }
                }
            ]
        );
    };

    // Delete notification
    const deleteNotification = (id: string) => {
        Alert.alert(
            'Delete Notification',
            'Are you sure you want to delete this notification?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setNotifications(prev => prev.filter(n => n._id !== id && n.id !== id));
                    }
                }
            ]
        );
    };

    // Format timestamp
    const formatTimestamp = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        return date.toLocaleDateString();
    };

    // Filter notifications
    const getFilteredNotifications = () => {
        switch (filter) {
            case 'unread':
                return notifications.filter(n => !n.isRead);
            case 'high':
                return notifications.filter(n => n.priority === 'high');
            default:
                return notifications;
        }
    };

    // Render notification item
    const renderNotificationItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[
                styles.notificationItem,
                !item.isRead && styles.unreadNotification,
                item.isRead && styles.readNotification
            ]}
            activeOpacity={0.7}
            onPress={() => {
                markAsRead(item._id || item.id || '');
            }}
            onLongPress={() => deleteNotification(item._id || item.id || '')}
        >
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: (item.color || '#6366F1') + '20' }]}>
                        <Ionicons name={item.icon as any || 'information-circle-outline'} size={20} color={item.color || '#6366F1'} />
                    </View>
                    <View style={styles.notificationText}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]}>
                                {item.action}
                            </Text>
                            {!item.isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notificationMessage}>{item.changeSummary}</Text>
                        <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
                    </View>
                </View>
                {item.priority === 'high' && (
                    <View style={styles.priorityBadge}>
                        <Text style={styles.priorityText}>High</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const filteredNotifications = getFilteredNotifications();

    if (loading && notifications.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accentNavyBlue} />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={filteredNotifications}
                renderItem={renderNotificationItem}
                keyExtractor={(item) => item._id || item.id || item.action}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                ListHeaderComponent={
                    <>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Notifications</Text>
                            {unreadCount > 0 && (
                                <TouchableOpacity onPress={markAllAsRead}>
                                    <Text style={styles.markAllButton}>Mark All Read</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter Tabs */}
                        <View style={styles.filterContainer}>
                            <TouchableOpacity
                                style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
                                onPress={() => setFilter('all')}
                            >
                                <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
                                    All ({notifications.length})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterTab, filter === 'unread' && styles.activeFilterTab]}
                                onPress={() => setFilter('unread')}
                            >
                                <Text style={[styles.filterText, filter === 'unread' && styles.activeFilterText]}>
                                    Unread ({unreadCount})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterTab, filter === 'high' && styles.activeFilterTab]}
                                onPress={() => setFilter('high')}
                            >
                                <Text style={[styles.filterText, filter === 'high' && styles.activeFilterText]}>
                                    Priority
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-outline" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyTitle}>No Notifications</Text>
                        <Text style={styles.emptySubtitle}>
                            {filter === 'unread'
                                ? "You're all caught up!"
                                : "New notifications will appear here"}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgMain,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40, // Add padding to account for footer
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },

    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        flex: 1,
        textAlign: 'left',
        marginRight: 40, // Offset for back button
    },
    markAllButton: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 12,
        borderRadius: 20,
        backgroundColor: COLORS.bgCardLight,
    },
    activeFilterTab: {
        backgroundColor: COLORS.accentNavyBlue,
    },
    filterText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    activeFilterText: {
        color: '#fff',
    },
    listContainer: {
        padding: 16,
    },
    notificationItem: {
        backgroundColor: COLORS.bgCard,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    unreadNotification: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.accentNavyBlue,
        backgroundColor: COLORS.bgCardLight,
    },
    readNotification: {
        backgroundColor: COLORS.bgCard,
        opacity: 0.9,
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    notificationText: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    unreadTitle: {
        color: COLORS.textPrimary,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#906AD1',
        marginLeft: 8,
    },
    notificationMessage: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
        marginBottom: 8,
    },
    timestamp: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    priorityBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    priorityText: {
        fontSize: 10,
        color: '#DC2626',
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
});