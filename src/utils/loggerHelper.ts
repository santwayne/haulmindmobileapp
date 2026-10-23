// src/utils/loggerHelper.ts
// This file provides a safe way to import the logger and avoids circular dependencies

let loggerInstance: any = null;

// Lazy initialization to avoid circular dependencies
export const getLogger = () => {
    if (!loggerInstance) {
        try {
            // Import the logger only when needed
            const Logger = require('./Logger').default;
            loggerInstance = Logger;
        } catch (error) {
            console.warn('Logger not available:', (error as Error).message);
            // Fallback logger that won't crash the app
            loggerInstance = {
                info: (message: string, data?: any, component?: string) => console.log(`INFO: ${message}`, data),
                error: (message: string, data?: any, component?: string) => console.error(`ERROR: ${message}`, data),
                warn: (message: string, data?: any, component?: string) => console.warn(`WARN: ${message}`, data),
                debug: (message: string, data?: any, component?: string) => console.log(`DEBUG: ${message}`, data),
                userAction: (action: string, data?: any, component?: string) => console.log(`USER ACTION: ${action}`, data),
                navigation: (from: string, to: string) => console.log(`NAVIGATION: ${from} → ${to}`),
                apiRequest: (method: string, url: string, data?: any) => console.log(`API REQUEST: ${method} ${url}`, data),
                apiResponse: (method: string, url: string, status: number, data?: any, duration?: string) =>
                    console.log(`API RESPONSE: ${method} ${url} - ${status}`, data),
                startTimer: (label: string) => {
                    const start = Date.now();
                    return () => console.log(`TIMER: ${label} completed in ${Date.now() - start}ms`);
                },
                getLogs: () => [],
                clearLogs: () => { },
                exportLogs: () => '[]',
                getLogsByLevel: (level: string) => []
            };
        }
    }
    return loggerInstance;
};

// Export individual methods for convenience
export const logger = {
    get info() { return getLogger().info; },
    get error() { return getLogger().error; },
    get warn() { return getLogger().warn; },
    get debug() { return getLogger().debug; },
    get userAction() { return getLogger().userAction; },
    get navigation() { return getLogger().navigation; },
    get apiRequest() { return getLogger().apiRequest; },
    get apiResponse() { return getLogger().apiResponse; },
    get startTimer() { return getLogger().startTimer; },
    get getLogs() { return getLogger().getLogs; },
    get clearLogs() { return getLogger().clearLogs; },
    get exportLogs() { return getLogger().exportLogs; },
    get getLogsByLevel() { return getLogger().getLogsByLevel; }
};