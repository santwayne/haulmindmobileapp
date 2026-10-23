// src/types/index.ts

// Driver Types (matching your backend schema)
export interface Driver {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  password?: string; // Not sent from backend for security
  role: string;
  policies: string;
  profileImageUrl?: string | null;
  details: {
    internalId: string;
    licenceNumber: string;
    vendor: string;
    vehicle: string; // ObjectId as string
    city: string;
    country: string;
  };
  status: 'active' | 'inactive';
  location: {
    longitude: string;
    latitude: string;
  };
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// Vehicle Types
export interface Vehicle {
  _id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  capacity: number;
  type: string;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

// Location Types (for socket and tracking)
export interface LocationPoint {
  latitude: string;
  longitude: string;
  timestamp?: Date;
}

export interface LiveLocation extends LocationPoint {
  updatedAt: Date;
}

// Load Types (for tracking)
export interface Load {
  _id: string;
  route?: {
    selectPickup?: LocationPoint;
    selectDropOff?: LocationPoint;
  };
  locationHistory: LocationPoint[];
  liveLocation?: LiveLocation;
  driverId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Socket Events Types
export interface SocketLocationUpdate {
  loadId: string;
  latitude: number;
  longitude: number;
  traveled: number;       // km
  totalDistance: number;  // km
  remaining: number;      // km
  history: LocationPoint[];
}

export interface DriverLocationPayload {
  loadId: string;
  latitude: number;
  longitude: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  driver: Driver | null;
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Navigation Types
export interface RootStackParamList {
  Login: undefined;
  Dashboard: undefined;
  Profile: undefined;
  LoadDetails: { loadId: string };
  LocationTracking: { loadId: string };
  Settings: undefined;
}

// Form Types
export interface UpdateProfileData {
  name?: string;
  phone?: string;
  details?: Partial<Driver['details']>;
  location?: LocationPoint;
}

// Error Types
export interface AppError {
  message: string;
  code?: string | number;
  details?: any;
}

// File Upload Types
export interface FileUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  size: number;
}

// Notification Types
export interface PushNotification {
  title: string;
  body: string;
  data?: any;
  sound?: string;
}

// Location Permission Types
export interface LocationPermission {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

// Distance and Route Types
export interface DistanceInfo {
  traveled: number;
  total: number;
  remaining: number;
  unit: 'km' | 'miles';
}

export interface RouteInfo {
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  distance: number;
  estimatedTime: number; // in minutes
}

// Filter and Sort Types
export interface LoadFilters {
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  location?: string;
}

export interface SortOptions {
  field: 'createdAt' | 'updatedAt' | 'distance';
  order: 'asc' | 'desc';
}