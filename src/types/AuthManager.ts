// src/managers/AuthManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/loggerHelper';

interface UserData {
    id: string;
    name: string;
    email: string;
    token: string;
    // Add other user properties as needed
}

interface AuthState {
    isAuthenticated: boolean;
    user: UserData | null;
    token: string | null;
    isLoading: boolean;
}

class AuthManager {
    private static instance: AuthManager;
    private authState: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: true,
    };

    private listeners: Array<(state: AuthState) => void> = [];

    // Storage keys
    private readonly STORAGE_KEYS = {
        TOKEN: 'auth_token',
        USER_DATA: 'user_data',
        REFRESH_TOKEN: 'refresh_token',
        LOGIN_TIMESTAMP: 'login_timestamp',
    };

    private constructor() {
        this.initializeAuth();
    }

    public static getInstance(): AuthManager {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager();
        }
        return AuthManager.instance;
    }

    // Initialize authentication state from storage
    private async initializeAuth(): Promise<void> {
        try {
            logger.info('Initializing authentication state', null, 'AuthManager');

            const [token, userData] = await Promise.all([
                this.getStoredToken(),
                this.getStoredUserData(),
            ]);

            if (token && userData) {
                // Check if token is expired
                if (await this.isTokenValid(token)) {
                    this.authState = {
                        isAuthenticated: true,
                        user: userData,
                        token,
                        isLoading: false,
                    };
                    logger.info('User authenticated from stored data', { userId: userData.id }, 'AuthManager');
                } else {
                    logger.warn('Stored token is invalid/expired', null, 'AuthManager');
                    await this.clearAuthData();
                }
            } else {
                this.authState.isLoading = false;
            }

            this.notifyListeners();
        } catch (error) {
            logger.error('Failed to initialize auth state', error, 'AuthManager');
            this.authState.isLoading = false;
            this.notifyListeners();
        }
    }

    // Login user and store data
    public async login(userData: UserData): Promise<void> {
        try {
            logger.info('Logging in user', { userId: userData.id, email: userData.email }, 'AuthManager');

            // Store auth data
            await Promise.all([
                AsyncStorage.setItem(this.STORAGE_KEYS.TOKEN, userData.token),
                AsyncStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(userData)),
                AsyncStorage.setItem(this.STORAGE_KEYS.LOGIN_TIMESTAMP, Date.now().toString()),
            ]);

            // Update state
            this.authState = {
                isAuthenticated: true,
                user: userData,
                token: userData.token,
                isLoading: false,
            };

            this.notifyListeners();
            logger.info('User login successful', { userId: userData.id }, 'AuthManager');
        } catch (error) {
            logger.error('Failed to store auth data', error, 'AuthManager');
            throw new Error('Failed to complete login process');
        }
    }

    // Logout user and clear data
    public async logout(): Promise<void> {
        try {
            logger.info('Logging out user', { userId: this.authState.user?.id }, 'AuthManager');

            await this.clearAuthData();

            this.authState = {
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
            };

            this.notifyListeners();
            logger.info('User logout successful', null, 'AuthManager');
        } catch (error) {
            logger.error('Failed to clear auth data', error, 'AuthManager');
        }
    }

    // Update user data
    public async updateUserData(userData: Partial<UserData>): Promise<void> {
        try {
            if (!this.authState.user) {
                throw new Error('No user logged in');
            }

            const updatedUser = { ...this.authState.user, ...userData };

            await AsyncStorage.setItem(
                this.STORAGE_KEYS.USER_DATA,
                JSON.stringify(updatedUser)
            );

            this.authState.user = updatedUser;
            this.notifyListeners();

            logger.info('User data updated', { userId: updatedUser.id }, 'AuthManager');
        } catch (error) {
            logger.error('Failed to update user data', error, 'AuthManager');
            throw error;
        }
    }

    // Get current auth state
    public getAuthState(): AuthState {
        return { ...this.authState };
    }

    // Check if user is authenticated
    public isAuthenticated(): boolean {
        return this.authState.isAuthenticated && !!this.authState.token;
    }

    // Get current user
    public getCurrentUser(): UserData | null {
        return this.authState.user;
    }

    // Get current token
    public getToken(): string | null {
        return this.authState.token;
    }

    // Subscribe to auth state changes
    public subscribe(listener: (state: AuthState) => void): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Private helper methods
    private async getStoredToken(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN);
        } catch (error) {
            logger.error('Failed to get stored token', error, 'AuthManager');
            return null;
        }
    }

    private async getStoredUserData(): Promise<UserData | null> {
        try {
            const userData = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_DATA);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            logger.error('Failed to get stored user data', error, 'AuthManager');
            return null;
        }
    }

    private async isTokenValid(token: string): Promise<boolean> {
        try {
            // Basic JWT expiration check (you can enhance this)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;

            if (payload.exp && payload.exp < currentTime) {
                logger.warn('Token is expired', { exp: payload.exp, current: currentTime }, 'AuthManager');
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Failed to validate token', error, 'AuthManager');
            return false;
        }
    }

    private async clearAuthData(): Promise<void> {
        try {
            await Promise.all([
                AsyncStorage.removeItem(this.STORAGE_KEYS.TOKEN),
                AsyncStorage.removeItem(this.STORAGE_KEYS.USER_DATA),
                AsyncStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN),
                AsyncStorage.removeItem(this.STORAGE_KEYS.LOGIN_TIMESTAMP),
            ]);
        } catch (error) {
            logger.error('Failed to clear auth data from storage', error, 'AuthManager');
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this.authState);
            } catch (error) {
                logger.error('Error in auth state listener', error, 'AuthManager');
            }
        });
    }

    // Utility methods
    public async getLoginDuration(): Promise<number | null> {
        try {
            const timestamp = await AsyncStorage.getItem(this.STORAGE_KEYS.LOGIN_TIMESTAMP);
            return timestamp ? Date.now() - parseInt(timestamp) : null;
        } catch {
            return null;
        }
    }

    public async refreshToken(): Promise<boolean> {
        try {
            // Implement token refresh logic here
            // This would typically make an API call to refresh the token
            logger.info('Token refresh not implemented', null, 'AuthManager');
            return false;
        } catch (error) {
            logger.error('Failed to refresh token', error, 'AuthManager');
            return false;
        }
    }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();
export default authManager;