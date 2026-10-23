// src/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@logistiq_push_token';

// Show system notification banner even when app is in foreground
// expo-notifications APIs are native-only — skip entirely on web
if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

class NotificationService {
    private _expoPushToken: string | null = null;

    // ─── Permission ───────────────────────────────────────────────────────────
    // Called early (App.tsx) — works for both local and push notifications

    async requestPermission(): Promise<boolean> {
        if (Platform.OS === 'web') return false;

        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;

        const { status } = await Notifications.requestPermissionsAsync();
        console.log('[Notifications] Permission status:', status);
        return status === 'granted';
    }

    // ─── Push Token (physical device only) ───────────────────────────────────

    async registerForPushNotifications(): Promise<string | null> {
        if (Platform.OS === 'web') return null;

        // Set up Android channels
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('logistiq-default', {
                name: 'Logistiq Notifications',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#8B5CF6',
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
            });
            await Notifications.setNotificationChannelAsync('logistiq-trips', {
                name: 'Trip Alerts',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#10B981',
                sound: 'default',
            });
            await Notifications.setNotificationChannelAsync('logistiq-chat', {
                name: 'Messages',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 150, 150, 150],
                lightColor: '#3B82F6',
                sound: 'default',
            });
        }

        const granted = await this.requestPermission();
        if (!granted) return null;

        try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: 'fefcce40-3b76-4b8d-b7c8-c74644f42676',
            });
            this._expoPushToken = tokenData.data;
            await AsyncStorage.setItem(PUSH_TOKEN_KEY, this._expoPushToken);
            console.log('[Notifications] Push token:', this._expoPushToken);
            return this._expoPushToken;
        } catch (err) {
            // Simulator or Expo Go — push token unavailable but local notifications still work
            console.warn('[Notifications] Push token unavailable (simulator or Expo Go):', err);
            return null;
        }
    }

    async getCachedToken(): Promise<string | null> {
        if (this._expoPushToken) return this._expoPushToken;
        const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (stored) this._expoPushToken = stored;
        return stored;
    }

    getToken(): string | null {
        return this._expoPushToken;
    }

    // ─── Listeners ────────────────────────────────────────────────────────────

    addForegroundListener(
        handler: (notification: Notifications.Notification) => void
    ): ReturnType<typeof Notifications.addNotificationReceivedListener> {
        if (Platform.OS === 'web') return { remove: () => {} } as any;
        return Notifications.addNotificationReceivedListener(handler);
    }

    addTapListener(
        handler: (response: Notifications.NotificationResponse) => void
    ): ReturnType<typeof Notifications.addNotificationResponseReceivedListener> {
        if (Platform.OS === 'web') return { remove: () => {} } as any;
        return Notifications.addNotificationResponseReceivedListener(handler);
    }

    removeSubscription(sub: { remove: () => void }) {
        sub.remove();
    }

    // ─── Badge ────────────────────────────────────────────────────────────────

    async setBadge(count: number) {
        if (Platform.OS === 'web') return;
        await Notifications.setBadgeCountAsync(count);
    }

    async clearBadge() {
        if (Platform.OS === 'web') return;
        await Notifications.setBadgeCountAsync(0);
    }

    // ─── Local notification (with optional delay to test system center) ───────

    async sendLocalNotification(
        title: string,
        body: string,
        data?: Record<string, any>,
        delaySeconds = 0
    ) {
        if (Platform.OS === 'web') return;
        try {
            const { status } = await Notifications.getPermissionsAsync();
            console.log('[Notifications] Current permission status:', status);

            if (status !== 'granted') {
                console.warn('[Notifications] Cannot send — permission not granted');
                return;
            }

            const trigger: Notifications.NotificationTriggerInput = delaySeconds > 0
                ? {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: delaySeconds,
                    repeats: false,
                }
                : null;

            console.log('[Notifications] Scheduling notification, trigger:', trigger);

            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data ?? {},
                    sound: 'default',
                    ...(Platform.OS === 'android' && { channelId: 'logistiq-default' }),
                },
                trigger,
            });

            console.log('[Notifications] Scheduled successfully, id:', id);
        } catch (err) {
            console.error('[Notifications] scheduleNotificationAsync failed:', err);
        }
    }

    // ─── Navigate on tap ─────────────────────────────────────────────────────

    getNavigationTarget(response: Notifications.NotificationResponse): {
        screen: string;
        params?: Record<string, any>;
    } | null {
        const data = response.notification.request.content.data as Record<string, any>;
        if (!data) return null;

        switch (data.type) {
            case 'chat':
            case 'message':
                return { screen: 'DriverChat' };
            case 'trip_assigned':
            case 'order_assigned':
            case 'task_assigned':
                return { screen: 'PendingTrips' };
            case 'trip_completed':
            case 'task_completed':
                return { screen: 'CompleteTrips' };
            default:
                return { screen: 'Notifications' };
        }
    }
}

export const notificationService = new NotificationService();
