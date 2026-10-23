// Crash Reporter - Saves crash logs to device storage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { logger } from './loggerHelper';

const CRASH_LOG_KEY = '@app_crash_logs';
const MAX_LOG_ENTRIES = 50; // Keep last 50 crash logs

export interface CrashLog {
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  component?: string;
  additionalData?: any;
  platform: string;
  appVersion?: string;
}

class CrashReporter {
  private static instance: CrashReporter;

  public static getInstance(): CrashReporter {
    if (!CrashReporter.instance) {
      CrashReporter.instance = new CrashReporter();
    }
    return CrashReporter.instance;
  }

  /**
   * Log a crash/error to device storage
   * IMPORTANT: This uses synchronous console logging first, then async save
   */
  async logCrash(
    error: Error,
    component?: string,
    additionalData?: any
  ): Promise<void> {
    try {
      const crashLog: CrashLog = {
        timestamp: new Date().toISOString(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        component: component || 'Unknown',
        additionalData: additionalData || {},
        platform: Platform.OS,
      };

      // CRITICAL: Log to console FIRST (synchronous - survives app termination)
      console.error('💥💥💥 CRASH START 💥💥💥');
      console.error('Component:', component || 'Unknown');
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Stack Trace:', error.stack);
      console.error('Additional Data:', JSON.stringify(additionalData || {}));
      console.error('Full Crash Log:', JSON.stringify(crashLog, null, 2));
      console.error('💥💥💥 CRASH END 💥💥💥');
      
      // Also use logger
      try {
        logger.error('Crash reported', crashLog, component || 'CrashReporter');
      } catch (e) {
        // Logger might fail, but console.error above will still work
      }

      // Save to AsyncStorage (async - might not complete if app terminates immediately)
      try {
        const existingLogs = await this.getCrashLogs();
        const newLogs = [crashLog, ...existingLogs].slice(0, MAX_LOG_ENTRIES);
        await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(newLogs));
      } catch (saveError) {
        console.error('Failed to save crash log to storage:', saveError);
        // Still logged to console above, so we're good
      }

      // Show error to user (optional - can be disabled)
      try {
        this.showCrashAlert(error, component);
      } catch (e) {
        // Alert might fail if app is terminating
      }
    } catch (saveError) {
      // Last resort - at least log something
      console.error('💥 FATAL: Crash reporter failed:', saveError);
      console.error('Original error:', error);
    }
  }

  /**
   * Synchronous crash log (for immediate termination scenarios)
   * This only logs to console but is guaranteed to run
   */
  logCrashSync(
    error: Error,
    component?: string,
    additionalData?: any
  ): void {
    console.error('💥💥💥 SYNC CRASH LOG 💥💥💥');
    console.error('Time:', new Date().toISOString());
    console.error('Component:', component || 'Unknown');
    console.error('Platform:', Platform.OS);
    console.error('Error:', error.name, '-', error.message);
    console.error('Stack:', error.stack);
    console.error('Data:', JSON.stringify(additionalData || {}));
    console.error('💥💥💥 SYNC CRASH LOG END 💥💥💥');
    
    // Also try async save (might not complete)
    this.logCrash(error, component, additionalData).catch(() => {
      // Ignore - already logged to console
    });
  }

  /**
   * Get all crash logs
   */
  async getCrashLogs(): Promise<CrashLog[]> {
    try {
      const logsJson = await AsyncStorage.getItem(CRASH_LOG_KEY);
      if (!logsJson) return [];
      return JSON.parse(logsJson);
    } catch (error) {
      console.error('Failed to read crash logs:', error);
      return [];
    }
  }

  /**
   * Clear all crash logs
   */
  async clearCrashLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CRASH_LOG_KEY);
    } catch (error) {
      console.error('Failed to clear crash logs:', error);
    }
  }

  /**
   * Get crash logs as formatted string
   */
  async getCrashLogsAsText(): Promise<string> {
    const logs = await this.getCrashLogs();
    if (logs.length === 0) {
      return 'No crash logs found.';
    }

    return logs
      .map((log, index) => {
        return `
=== Crash Log #${index + 1} ===
Time: ${log.timestamp}
Component: ${log.component || 'Unknown'}
Platform: ${log.platform}
Error: ${log.error.name}
Message: ${log.error.message}
${log.error.stack ? `Stack:\n${log.error.stack}` : ''}
${log.additionalData ? `Additional Data: ${JSON.stringify(log.additionalData, null, 2)}` : ''}
`;
      })
      .join('\n---\n');
  }

  /**
   * Show crash alert to user
   */
  private showCrashAlert(error: Error, component?: string): void {
    // Only show in development or if user enabled crash reporting
    // In production, you might want to disable this
    if (__DEV__) {
      Alert.alert(
        'App Error',
        `An error occurred in ${component || 'the app'}.\n\n${error.message}\n\nCheck Settings > View Crash Logs for details.`,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Export crash logs for sharing
   */
  async exportCrashLogs(): Promise<string> {
    const logs = await this.getCrashLogs();
    const exportData = {
      platform: Platform.OS,
      exportTime: new Date().toISOString(),
      totalCrashes: logs.length,
      logs: logs,
    };

    return JSON.stringify(exportData, null, 2);
  }
}

export const crashReporter = CrashReporter.getInstance();

// Initialize global error handlers IMMEDIATELY when module loads
(function setupGlobalErrorHandlers() {
  // React Native ErrorUtils - catches errors before app terminates
  if (typeof global !== 'undefined' && global.ErrorUtils) {
    const originalErrorHandler = global.ErrorUtils.getGlobalHandler?.();
    
    global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error('💥💥💥 GLOBAL ERROR HANDLER TRIGGERED 💥💥💥');
      console.error('Fatal:', isFatal);
      console.error('Error:', error);
      
      // CRITICAL: Use sync logging first (guaranteed to run)
      crashReporter.logCrashSync(error, 'GlobalErrorHandler', { 
        isFatal: isFatal || false,
        timestamp: new Date().toISOString()
      });
      
      // Also try async save
      crashReporter.logCrash(error, 'GlobalErrorHandler', { isFatal }).catch(() => {
        // Already logged to console
      });
      
      // Call original handler if it exists
      if (originalErrorHandler) {
        try {
          originalErrorHandler(error, isFatal);
        } catch (e) {
          console.error('Original error handler failed:', e);
        }
      }
    });
  }

  // Catch unhandled promise rejections
  if (typeof global !== 'undefined') {
    const originalUnhandledRejection = (global as any).onunhandledrejection;
    
    (global as any).onunhandledrejection = (event: any) => {
      console.error('💥💥💥 UNHANDLED PROMISE REJECTION 💥💥💥');
      const error = event?.reason || new Error('Unhandled Promise Rejection');
      crashReporter.logCrashSync(
        error instanceof Error ? error : new Error(String(error)),
        'UnhandledPromiseRejection',
        { event }
      );
      
      if (originalUnhandledRejection) {
        originalUnhandledRejection(event);
      }
    };
  }

  // Node.js style unhandled rejection (for React Native)
  if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('💥💥💥 PROCESS UNHANDLED REJECTION 💥💥💥');
      const error = reason instanceof Error ? reason : new Error(String(reason));
      crashReporter.logCrashSync(error, 'ProcessUnhandledRejection', { promise });
    });
  }
})();

