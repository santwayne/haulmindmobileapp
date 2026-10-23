// src/config/env.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';
// Conditionally import expo-network (not available in Expo Go)
let Network: any = null;
try {
  Network = require('expo-network');
} catch (e) {
  // expo-network not available (e.g., in Expo Go)
  console.warn('expo-network not available, using fallback IP detection');
}

// Try to import from @env, but handle if it fails (e.g., during EAS build)
let ENV_API_BASE_URL: string | undefined;
let ENV_SOCKET_URL: string | undefined;
let ENV_NODE_ENV: string | undefined;
let ENV_DB_NAME: string | undefined;
let ENV_GOOGLE_MAPS_API_KEY: string | undefined;
let ENV_MAPTILER_API_KEY: string | undefined;
let ENV_STADIA_API_KEY: string | undefined;

try {
  const envModule = require('@env');
  ENV_API_BASE_URL = envModule.API_BASE_URL;
  ENV_SOCKET_URL = envModule.SOCKET_URL;
  ENV_NODE_ENV = envModule.NODE_ENV;
  ENV_DB_NAME = envModule.DB_NAME;
  ENV_GOOGLE_MAPS_API_KEY = envModule.GOOGLE_MAPS_API_KEY;
  ENV_MAPTILER_API_KEY = envModule.MAPTILER_API_KEY;
  ENV_STADIA_API_KEY = envModule.STADIA_API_KEY;
} catch (e) {
  // @env not available, use process.env (from EAS build env vars)
  console.log('⚠️ @env module not available, using process.env');
  ENV_API_BASE_URL = process.env.API_BASE_URL;
  ENV_SOCKET_URL = process.env.SOCKET_URL;
  ENV_NODE_ENV = process.env.NODE_ENV;
  ENV_DB_NAME = process.env.DB_NAME;
  ENV_GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  ENV_MAPTILER_API_KEY = process.env.MAPTILER_API_KEY;
  ENV_STADIA_API_KEY = process.env.STADIA_API_KEY;
}

// Debug: Log imported .env values
console.log('📦 Environment values loaded:', {
    ENV_API_BASE_URL,
    ENV_SOCKET_URL,
    ENV_NODE_ENV,
    ENV_DB_NAME,
    source: ENV_API_BASE_URL ? (ENV_API_BASE_URL.includes('portal.logistiqinnovations.ca') ? 'EAS/production' : '@env') : 'none'
});

type ManifestWithReleaseChannel = typeof Constants.manifest & {
    releaseChannel?: string;
};

interface Config {
    API_BASE_URL: string;
    SOCKET_URL: string;
    NODE_ENV: string;
    DB_NAME: string;
    GOOGLE_MAPS_API_KEY?: string;
    MAPTILER_API_KEY?: string;
    STADIA_API_KEY?: string;
}


const getCurrentIP = async (): Promise<string | null> => {
    try {
        // Only use expo-network if available (requires custom build)
        if (Network) {
            const networkState = await Network.getNetworkStateAsync();

            if (!networkState.isConnected) {
                console.log('❌ Not connected to network');
                return null;
            }

            const ipAddress = await Network.getIpAddressAsync();

            if (ipAddress && ipAddress !== '127.0.0.1') {
                console.log(`🌐 Current IP detected: ${ipAddress}`);
                return ipAddress;
            }
        } else {
            console.log('ℹ️ expo-network not available, using fallback IP detection');
        }

        return null;
    } catch (error) {
        console.log('❌ Failed to get current IP:', error);
        return null;
    }
};


const getFallbackIPs = () => {
    // If .env has values, don't use fallback IPs - force use of .env
    if (ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined') {
        // Extract IP from .env URL if possible
        const envUrl = ENV_API_BASE_URL;
        const match = envUrl.match(/http:\/\/([^:]+)/);
        if (match && match[1]) {
            return [match[1]]; // Only return the .env IP
        }
    }
    
    const possibleIPs = [
        // Add common server IPs first (prioritize these)
        '192.168.1.9', // Primary network IP - LOCAL SERVER
        '192.168.1.4', // Previous server IP
        '192.168.31.161', // Current system IP (Windows Wi-Fi adapter)
        '192.168.31.247', // Alternative server IP
        '192.168.1.17',
        '192.168.1.16',
        '192.168.0.16',
        '192.168.0.17',
        '10.0.0.16',
        '10.0.0.17',
        '192.168.1.100',
        '192.168.1.101',
        '192.168.0.100',
        '192.168.0.101',
        '192.168.1.2'
    ];

    return possibleIPs;
};


const getLocalIP = async (): Promise<string> => {
    // PRIORITY 1: Use .env value if available, BUT replace 192.168.1.4 with 192.168.1.9
    if (ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined') {
        const envUrl = ENV_API_BASE_URL;
        const match = envUrl.match(/http:\/\/([^:]+)/);
        if (match && match[1]) {
            const envIP = match[1];
            // Force replace old IP with new IP
            if (envIP === '192.168.1.4') {
                console.log(`⚠️ Replacing old IP 192.168.1.4 with 192.168.1.9`);
                return '192.168.1.9';
            }
            console.log(`✅ Using .env IP: ${envIP}`);
            return envIP;
        }
    }
    
    // PRIORITY 2: Try auto-detection
    const currentIP = await getCurrentIP();
    if (currentIP && currentIP !== '192.168.1.4') {
        return currentIP;
    }

    // PRIORITY 3: Use fallback IPs (192.168.1.9 is first)
    const fallbackIPs = getFallbackIPs();
    console.log('🔄 Using fallback IPs, auto-detection failed');

    if (Platform.OS === 'android') {
        return fallbackIPs[0]; // This will be 192.168.1.9
    }

    return fallbackIPs[0]; // This will be 192.168.1.9
};

const getAPIEndpoints = async (): Promise<string[]> => {
    const endpoints: string[] = [];

    const currentIP = await getCurrentIP();

    if (currentIP) {
        endpoints.push(`http://${currentIP}:3000/api/v1`);
    }

    const fallbackIPs = getFallbackIPs();
    endpoints.push(...fallbackIPs.map(ip => `http://${ip}:3000/api/v1`));

    if (Platform.OS === 'android') {
        endpoints.push(
            'http://10.0.2.2:3000/api/v1',
            'http://localhost:3000/api/v1',
            'http://127.0.0.1:3000/api/v1'
        );
    } else if (Platform.OS === 'ios') {
        endpoints.push('http://localhost:3000/api/v1');
    } else {
        endpoints.push('http://localhost:3000/api/v1');
    }

    return [...new Set(endpoints)];
};

const createENVConfig = async () => {
    const localIP = await getLocalIP();
    // Use 192.168.1.9 as primary development IP if localIP detection fails or returns wrong IP
    const devIP = localIP && localIP !== '192.168.1.4' ? localIP : '192.168.1.9';

    return {
        development: {
            API_BASE_URL: `http://${devIP}:3000/api/v1`,
            SOCKET_URL: `http://192.168.1.3:3000`,
            NODE_ENV: 'development',
            DB_NAME: 'blackriver',
        },
        staging: {
            API_BASE_URL: 'https://staging-api.blackriver.com/api/v1',
            SOCKET_URL: 'https://staging-api.blackriver.com',
            NODE_ENV: 'staging',
            DB_NAME: 'blackriver-staging',
        },
        production: {
            API_BASE_URL: 'https://api.blackriver.com/api/v1',
            SOCKET_URL: 'https://api.blackriver.com',
            NODE_ENV: 'production',
            DB_NAME: 'blackriver-prod',
        },
    };
};

const manifest = Constants.manifest as ManifestWithReleaseChannel;


let configCache: Config | null = null;

const getEnvVars = async (env = manifest?.releaseChannel): Promise<Config> => {
    if (configCache) return configCache;

    const ENV = await createENVConfig();

    let config: Config;
    if (env === 'production') config = ENV.production;
    else if (env === 'staging') config = ENV.staging;
    else config = ENV.development;

    configCache = config;
    return config;
};

// Global variables - Load from .env file with fallbacks
// These will be updated by initConfig() but provide immediate values from .env
let config: Config | null = null;

// Get values from .env file, process.env (EAS), or Constants.extra, with platform-specific fallbacks
const getDefaultBaseURL = (): string => {
  // Priority 1: .env or process.env value (but replace old IP)
  if (ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined') {
    // Force replace 192.168.1.4 with 192.168.1.9
    if (ENV_API_BASE_URL.includes('192.168.1.4')) {
      const updatedUrl = ENV_API_BASE_URL.replace('192.168.1.4', '192.168.1.9');
      console.log(`⚠️ Replacing old IP in .env: ${ENV_API_BASE_URL} -> ${updatedUrl}`);
      return updatedUrl;
    }
    return ENV_API_BASE_URL;
  }
  
  // Priority 2: Constants.extra (from app.json)
  const extraConfig = Constants.expoConfig?.extra;
  if (extraConfig?.apiBaseUrl) {
    return extraConfig.apiBaseUrl;
  }
  
  // Priority 3: Development server IP (192.168.1.9) - check NODE_ENV directly
  const nodeEnv = (ENV_NODE_ENV && ENV_NODE_ENV !== 'undefined') ? ENV_NODE_ENV : 'development';
  if (nodeEnv === 'development') {
    return 'http://192.168.1.9:3000/api/v1';
  }
  
  // Priority 4: Platform-specific fallbacks
  return Platform.OS === 'android' 
    ? 'http://10.0.2.2:3000/api/v1'  // Android emulator default
    : 'http://localhost:3000/api/v1'; // iOS simulator / web default
};

const getDefaultSocketURL = (): string => {
  // Priority 1: .env or process.env value
  if (ENV_SOCKET_URL && ENV_SOCKET_URL !== 'undefined') {
    return ENV_SOCKET_URL;
  }
  
  // Priority 2: Constants.extra (from app.json)
  const extraConfig = Constants.expoConfig?.extra;
  if (extraConfig?.socketUrl) {
    return extraConfig.socketUrl;
  }
  
  // Priority 3: Development server IP (192.168.1.9) - check NODE_ENV directly
  const nodeEnv = (ENV_NODE_ENV && ENV_NODE_ENV !== 'undefined') ? ENV_NODE_ENV : 'development';
  if (nodeEnv === 'development') {
    return 'http://192.168.1.9:3000';
  }
  
  // Priority 4: Platform-specific fallbacks
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';
};

let API_BASE_URL: string = getDefaultBaseURL();
let SOCKET_URL: string = getDefaultSocketURL();
let NODE_ENV: string = (ENV_NODE_ENV && ENV_NODE_ENV !== 'undefined') ? ENV_NODE_ENV : 'development';
let DB_NAME: string = (ENV_DB_NAME && ENV_DB_NAME !== 'undefined') ? ENV_DB_NAME : 'blackriver';
let GOOGLE_MAPS_API_KEY: string | undefined = ENV_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey;
let MAPTILER_API_KEY: string | undefined = ENV_MAPTILER_API_KEY;
let STADIA_API_KEY: string | undefined = ENV_STADIA_API_KEY;
let IS_DEV: boolean = NODE_ENV === 'development';
let IS_PROD: boolean = NODE_ENV === 'production';
let API_ENDPOINTS: string[] = [API_BASE_URL];


const initConfig = async () => {
    try {
        // Check if .env values exist - if so, skip auto-detection entirely
        const hasEnvValues = (ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined') || 
                           (ENV_SOCKET_URL && ENV_SOCKET_URL !== 'undefined');
        
        if (hasEnvValues) {
            console.log('✅ .env file detected - checking for old IP');
            // Use .env values directly, but replace old IP with new IP
            if (ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined') {
                // Force replace 192.168.1.4 with 192.168.1.9
                if (ENV_API_BASE_URL.includes('192.168.1.4')) {
                    API_BASE_URL = ENV_API_BASE_URL.replace('192.168.1.4', '192.168.1.9');
                    console.log(`⚠️ Replaced old IP in .env: ${ENV_API_BASE_URL} -> ${API_BASE_URL}`);
                } else {
                    API_BASE_URL = ENV_API_BASE_URL;
                    console.log(`✅ Using .env API_BASE_URL: ${API_BASE_URL}`);
                }
            }
            
            if (ENV_SOCKET_URL && ENV_SOCKET_URL !== 'undefined') {
                // Force replace 192.168.1.4 with 192.168.1.9
                if (ENV_SOCKET_URL.includes('192.168.1.4')) {
                    SOCKET_URL = ENV_SOCKET_URL.replace('192.168.1.4', '192.168.1.9');
                    console.log(`⚠️ Replaced old IP in .env: ${ENV_SOCKET_URL} -> ${SOCKET_URL}`);
                } else {
                    SOCKET_URL = ENV_SOCKET_URL;
                    console.log(`✅ Using .env SOCKET_URL: ${SOCKET_URL}`);
                }
            }
            
            // Still get config for other values (NODE_ENV, DB_NAME)
            config = await getEnvVars();
        } else {
            console.log('🚀 No .env values found - using auto-detection...');
            config = await getEnvVars();

            // Use auto-detected values
            if (config.API_BASE_URL && config.API_BASE_URL !== getDefaultBaseURL()) {
                console.log(`⚠️ Using auto-detected API_BASE_URL: ${config.API_BASE_URL}`);
                API_BASE_URL = config.API_BASE_URL;
            } else {
                console.log(`⚠️ Using default API_BASE_URL: ${getDefaultBaseURL()}`);
            }
            
            if (config.SOCKET_URL && config.SOCKET_URL !== getDefaultSocketURL()) {
                console.log(`⚠️ Using auto-detected SOCKET_URL: ${config.SOCKET_URL}`);
                SOCKET_URL = config.SOCKET_URL;
            } else {
                console.log(`⚠️ Using default SOCKET_URL: ${getDefaultSocketURL()}`);
            }
        }
        // Use .env NODE_ENV if provided, otherwise use config
        if (ENV_NODE_ENV && ENV_NODE_ENV !== 'undefined') {
            NODE_ENV = ENV_NODE_ENV;
        } else {
            NODE_ENV = config.NODE_ENV;
        }
        // Use .env DB_NAME if provided, otherwise use config
        if (ENV_DB_NAME && ENV_DB_NAME !== 'undefined') {
            DB_NAME = ENV_DB_NAME;
        } else {
            DB_NAME = config.DB_NAME;
        }
        IS_DEV = NODE_ENV === 'development';
        IS_PROD = NODE_ENV === 'production';

        if (IS_DEV) {
            // If .env values exist, prioritize them in endpoints list
            if (hasEnvValues) {
                // Use .env URL as primary, add fallbacks
                API_ENDPOINTS = [API_BASE_URL];
                const fallbackEndpoints = await getAPIEndpoints();
                // Add fallbacks but don't override .env URL
                for (const endpoint of fallbackEndpoints) {
                    if (endpoint !== API_BASE_URL && !API_ENDPOINTS.includes(endpoint)) {
                        API_ENDPOINTS.push(endpoint);
                    }
                }
            } else {
                API_ENDPOINTS = await getAPIEndpoints();
                // Ensure baseURL is in endpoints list
                if (!API_ENDPOINTS.includes(API_BASE_URL)) {
                    API_ENDPOINTS.unshift(API_BASE_URL);
                }
            }
        } else {
            API_ENDPOINTS = [API_BASE_URL];
        }

        if (IS_DEV) {
            const currentIP = await getCurrentIP();
            console.log('🚀 Environment Config:', {
                'Detected IP': currentIP,
                API_BASE_URL,
                SOCKET_URL,
                NODE_ENV,
                DB_NAME,
                Platform: Platform.OS,
                'Available Endpoints': API_ENDPOINTS.slice(0, 5),
                'Total Endpoints': API_ENDPOINTS.length
            });
        }
    } catch (error) {
        console.error('❌ Failed to initialize config:', error);
        // Keep default values if initialization fails
        console.log('⚠️ Using default configuration:', {
            API_BASE_URL,
            SOCKET_URL,
            NODE_ENV,
            Platform: Platform.OS
        });
    }
};

// Start initialization immediately
initConfig().catch(error => {
    console.error('❌ Config initialization error:', error);
});

export const testConnection = async (url?: string): Promise<boolean> => {
    const testUrl = url || API_BASE_URL || 'http://localhost:3000/api/v1';

    try {
        console.log(`🧪 Testing connection to: ${testUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const healthUrl = `${testUrl.replace('/api/v1', '')}/api/v1/health`;

        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log(`✅ Connection successful to: ${testUrl}`);
            return true;
        } else {
            console.log(`❌ Connection failed with status: ${response.status}`);
            return false;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Connection test failed for ${testUrl}:`, errorMessage);
        return false;
    }
};


export const findWorkingEndpoint = async (): Promise<string | null> => {
    if (!IS_DEV) {
        return API_BASE_URL;
    }

    const currentIP = await getCurrentIP();
    if (currentIP) {
        const currentEndpoint = `http://${currentIP}:3000/api/v1`;
        console.log(`🎯 Testing current IP endpoint: ${currentEndpoint}`);

        if (await testConnection(currentEndpoint)) {
            console.log(`✅ Current IP endpoint works: ${currentEndpoint}`);

            // Don't override .env values - only update if no .env values exist
            if (config && !(ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined')) {
                config.API_BASE_URL = currentEndpoint;
                config.SOCKET_URL = currentEndpoint.replace('/api/v1', '');
            }

            return currentEndpoint;
        }
    }

    for (const endpoint of API_ENDPOINTS) {
        if (currentIP && endpoint.includes(currentIP)) {
            continue;
        }

        console.log(`Testing fallback endpoint: ${endpoint}`);
        if (await testConnection(endpoint)) {
            console.log(`✅ Found working endpoint: ${endpoint}`);

            // Don't override .env values - only update if no .env values exist
            if (config && !(ENV_API_BASE_URL && ENV_API_BASE_URL !== 'undefined')) {
                config.API_BASE_URL = endpoint;
                config.SOCKET_URL = endpoint.replace('/api/v1', '');
            }

            return endpoint;
        }
    }

    console.log('❌ No working endpoints found');
    return API_BASE_URL;
};


export const refreshConfig = async (): Promise<void> => {
    console.log('🔄 Refreshing configuration...');
    configCache = null;
    await initConfig();
    console.log('✅ Configuration refreshed');
};

// Export functions
export const getConfig = async (): Promise<Config> => {
    if (!config) {
        await initConfig();
    }
    
    // Always return current values from global variables (which respect .env)
    // This ensures .env values take priority over cached config object
    return {
        API_BASE_URL: API_BASE_URL,  // Use global variable (respects .env)
        SOCKET_URL: SOCKET_URL,      // Use global variable (respects .env)
        NODE_ENV: NODE_ENV,
        DB_NAME: DB_NAME,
        GOOGLE_MAPS_API_KEY: GOOGLE_MAPS_API_KEY,
        MAPTILER_API_KEY: MAPTILER_API_KEY,
        STADIA_API_KEY: STADIA_API_KEY,
    };
};

export const getAPIBaseURL = async (): Promise<string> => {
    if (!API_BASE_URL) {
        await initConfig();
    }
    return API_BASE_URL;
};

// Export variables
export {
    config,
    API_BASE_URL,
    SOCKET_URL,
    NODE_ENV,
    DB_NAME,
    GOOGLE_MAPS_API_KEY,
    MAPTILER_API_KEY,
    STADIA_API_KEY,
    IS_DEV,
    IS_PROD,
    API_ENDPOINTS,
    getCurrentIP
};


export const useConfig = () => {
    return {
        API_BASE_URL,
        SOCKET_URL,
        NODE_ENV,
        DB_NAME,
        GOOGLE_MAPS_API_KEY,
        MAPTILER_API_KEY,
        STADIA_API_KEY,
        IS_DEV,
        IS_PROD,
        API_ENDPOINTS,
        refreshConfig,
        getCurrentIP
    };
};