import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import Logger from './src/utils/Logger';
import { notificationService } from './src/services/notificationService';
// IMPORTANT: Import crash reporter early to initialize global handlers
import './src/utils/crashReporter';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const tapListenerRef = useRef<{ remove: () => void } | null>(null);

  // Log app initialization + request notification permission early
  useEffect(() => {
    Logger.info('App initialized', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    }, 'App');
    // Request permission on first launch so iOS shows the Allow/Don't Allow dialog
    notificationService.requestPermission();
  }, []);

  // Handle notification tap — navigate to correct screen
  useEffect(() => {
    tapListenerRef.current = notificationService.addTapListener((response) => {
      const target = notificationService.getNavigationTarget(response);
      if (!target || !navigationRef.current) return;
      // Small delay to ensure navigator is mounted
      setTimeout(() => {
        try {
          navigationRef.current?.navigate(target.screen as never);
        } catch {
          // ignore
        }
      }, 300);
    });

    // Handle tap that launched the app from killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || !navigationRef.current) return;
      const target = notificationService.getNavigationTarget(response);
      if (!target) return;
      setTimeout(() => {
        try {
          navigationRef.current?.navigate(target.screen as never);
        } catch {
          // ignore
        }
      }, 1000); // longer delay for killed-state launch
    });

    return () => {
      if (tapListenerRef.current) {
        notificationService.removeSubscription(tapListenerRef.current);
      }
    };
  }, []);

  // Set document title for web platform
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const setTitle = () => {
        const appTitle = Constants.expoConfig?.web?.title ||
                         Constants.expoConfig?.name ||
                         'Logistiq Innovations - Driver App';
        document.title = appTitle;
        let metaTitle = document.querySelector('meta[property="og:title"]');
        if (!metaTitle) {
          metaTitle = document.createElement('meta');
          metaTitle.setAttribute('property', 'og:title');
          document.head.appendChild(metaTitle);
        }
        metaTitle.setAttribute('content', appTitle);
      };
      setTitle();
      const timeoutId = setTimeout(setTitle, 100);
      window.addEventListener('focus', setTitle);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('focus', setTitle);
      };
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          documentTitle={{
            formatter: (options, route) => {
              return options?.title ?? route?.name ?? 'Logistiq Innovations - Driver App';
            },
          }}
        >
          <StatusBar style="light" backgroundColor="transparent" translucent={false} />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
