// src/utils/Logger.ts
import { NODE_ENV } from '../config/env';

enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
    component?: string;
}

class LoggerClass {
    private static instance: LoggerClass;
    private logLevel: LogLevel;
    private logs: LogEntry[] = [];
    private maxLogs: number = 1000;

    constructor() {
        // Set log level based on environment
        this.logLevel = NODE_ENV === 'production'
            ? LogLevel.ERROR
            : NODE_ENV === 'staging'
                ? LogLevel.WARN
                : LogLevel.DEBUG;
    }

    public static getInstance(): LoggerClass {
        if (!LoggerClass.instance) {
            LoggerClass.instance = new LoggerClass();
        }
        return LoggerClass.instance;
    }

    private shouldLog(level: LogLevel): boolean {
        return level <= this.logLevel;
    }

    private formatMessage(level: string, message: string, data?: any, component?: string): string {
        const timestamp = new Date().toISOString();
        const emoji = this.getEmojiForLevel(level);
        const componentTag = component ? `[${component}]` : '';
        return `${emoji} ${timestamp} ${level} ${componentTag} ${message}`;
    }

    private getEmojiForLevel(level: string): string {
        switch (level) {
            case 'ERROR': return '🔥';
            case 'WARN': return '⚠️';
            case 'INFO': return 'ℹ️';
            case 'DEBUG': return '🐛';
            default: return '📝';
        }
    }

    private addToHistory(level: string, message: string, data?: any, component?: string) {
        const logEntry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            component,
        };

        this.logs.push(logEntry);

        // Keep only the last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    // Core logging methods
    // Core logging methods (using arrow functions to preserve 'this' context)
    public error = (message: string, data?: any, component?: string): void => {
        if (this.shouldLog(LogLevel.ERROR)) {
            const formattedMessage = this.formatMessage('ERROR', message, data, component);
            console.error(formattedMessage);
            if (data) console.error('Error Data:', data);
            this.addToHistory('ERROR', message, data, component);

            // In production, send to crash reporting service
            if (NODE_ENV === 'production') {
                this.sendToRemoteLogger('ERROR', message, data, component);
            }
        }
    }

    public warn = (message: string, data?: any, component?: string): void => {
        if (this.shouldLog(LogLevel.WARN)) {
            const formattedMessage = this.formatMessage('WARN', message, data, component);
            console.warn(formattedMessage);
            if (data) console.warn('Warning Data:', data);
            this.addToHistory('WARN', message, data, component);
        }
    }

    public info = (message: string, data?: any, component?: string): void => {
        if (this.shouldLog(LogLevel.INFO)) {
            const formattedMessage = this.formatMessage('INFO', message, data, component);
            console.info(formattedMessage);
            if (data) console.info('Info Data:', data);
            this.addToHistory('INFO', message, data, component);
        }
    }

    public debug = (message: string, data?: any, component?: string): void => {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formattedMessage = this.formatMessage('DEBUG', message, data, component);
            console.log(formattedMessage);
            if (data) console.log('Debug Data:', data);
            this.addToHistory('DEBUG', message, data, component);
        }
    }

    // Specialized logging methods
    public apiRequest(method: string, url: string, data?: any): void {
        this.debug(`API ${method.toUpperCase()} Request`, {
            url,
            payload: data,
            timestamp: new Date().toISOString(),
        }, 'ApiService');
    }

    public apiResponse(method: string, url: string, status: number, data?: any, duration?: string): void {
        const level = status >= 400 ? 'warn' : 'debug';
        if (level === 'warn') {
            this.warn(`API ${method.toUpperCase()} Response`, {
                url,
                status,
                response: data,
                duration,
                timestamp: new Date().toISOString(),
            }, 'ApiService');
        } else {
            this.debug(`API ${method.toUpperCase()} Response`, {
                url,
                status,
                response: data,
                duration,
                timestamp: new Date().toISOString(),
            }, 'ApiService');
        }
    }

    public userAction(action: string, data?: any, component?: string): void {
        this.info(`User Action: ${action}`, data, component);
    }

    public navigation(from: string, to: string): void {
        this.info(`Navigation: ${from} → ${to}`, null, 'Navigation');
    }

    // Utility methods
    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public getLogsByLevel(level: string): LogEntry[] {
        return this.logs.filter(log => log.level === level);
    }

    public clearLogs(): void {
        this.logs = [];
        this.info('Logs cleared');
    }

    public exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    // Remote logging for production
    private async sendToRemoteLogger(level: string, message: string, data?: any, component?: string): Promise<void> {
        try {
            // Replace with your logging service (Sentry, LogRocket, etc.)
            const logData = {
                level,
                message,
                data,
                component,
                timestamp: new Date().toISOString(),
                platform: 'react-native',
                environment: NODE_ENV,
            };

            // Example: Send to your backend logging endpoint
            await fetch(`${process.env.API_BASE_URL}/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logData),
            });
        } catch (error) {
            // Fallback: at least log locally if remote logging fails
            console.error('Failed to send log to remote service:', error);
        }
    }

    // Performance monitoring
    public startTimer(label: string): () => void {
        const startTime = Date.now();
        this.debug(`Timer started: ${label}`, { startTime }, 'Performance');

        return () => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            this.info(`Timer completed: ${label}`, {
                duration: `${duration}ms`,
                startTime,
                endTime
            }, 'Performance');
        };
    }
}

// Create and export the singleton instance immediately
const Logger = LoggerClass.getInstance();

// Export both the instance and the class if needed
export { LoggerClass };
export default Logger;