declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";

declare module '@env' {
  export const API_BASE_URL: string;
  export const SOCKET_URL: string;
  export const NODE_ENV: string;
  export const DB_NAME: string;
}

// Type declarations for React Native ErrorUtils
declare global {
  interface ErrorUtils {
    getGlobalHandler(): ((error: Error, isFatal?: boolean) => void) | undefined;
    setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
  }

  const ErrorUtils: ErrorUtils;
}