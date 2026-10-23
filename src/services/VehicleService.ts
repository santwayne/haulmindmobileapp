import { apiService } from './api/apiService';
import { logger } from '../utils/loggerHelper';
import { Vehicle, VehicleListResponse, VehicleFilter } from '../types/Vehicle';
import AsyncStorage from '@react-native-async-storage/async-storage';

class VehicleService {
    private readonly endpoint = '/driver/vehicle';
    private readonly selectedVehicleEndpoint = '/driver/selected-vehicle';

    /**
     * Get driver ID from AsyncStorage
     */
    private async getDriverId(): Promise<string | null> {
        try {
            // Try multiple storage keys
            const storageKeys = [
                'auth_token',
                'userData',
                'driverId', 
                'userId',
                'user',
                'driver'
            ];

            for (const key of storageKeys) {
                const value = await AsyncStorage.getItem(key);
                if (value) {
                    console.log(`Found data in ${key}:`, value.substring(0, 50) + '...');
                    
                    // Check if it's a JWT token
                    if (value.startsWith('eyJ')) {
                        try {
                            const decodedId = this.extractIdFromJWT(value);
                            if (decodedId) {
                                console.log(`Extracted driver ID from JWT in ${key}:`, decodedId);
                                return decodedId;
                            }
                        } catch (jwtError) {
                            console.warn('Failed to decode JWT:', jwtError);
                        }
                    }
                    
                    try {
                        const parsed = JSON.parse(value);
                        // Check various possible ID fields
                        const possibleIds = [
                            parsed?.userId,
                            parsed?.driverId,
                            parsed?.id,
                            parsed?._id,
                            parsed?.driver?.id,
                            parsed?.driver?.userId,
                            parsed?.driver?._id
                        ];
                        
                        for (const id of possibleIds) {
                            if (id && typeof id === 'string') {
                                console.log(`Using driver ID from ${key}:`, id);
                                return id;
                            }
                        }
                    } catch {
                        // If not JSON, maybe it's a direct ID string
                        if (typeof value === 'string' && value.length > 10 && !value.startsWith('eyJ')) {
                            console.log(`Using direct ID from ${key}:`, value);
                            return value;
                        }
                    }
                }
            }

            // If nothing found, use the hardcoded test ID as fallback
            const testDriverId = '68b93728af1dd26ef9176dad';
            console.log('No driver ID found in storage, using test ID:', testDriverId);
            return testDriverId;

        } catch (error) {
            console.error('Failed to get driver ID:', error);
            // Return test ID as fallback
            return '68b93728af1dd26ef9176dad';
        }
    }

    /**
     * Extract driver ID from JWT token
     */
    private extractIdFromJWT(token: string): string | null {
        try {
            // Split the JWT token
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            // Decode the payload (second part)
            const payload = parts[1];
            
            // Add padding if needed for base64 decoding
            const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
            
            // Decode base64
            const decodedPayload = atob(paddedPayload);
            
            // Parse JSON
            const parsedPayload = JSON.parse(decodedPayload);
            
            console.log('JWT payload:', parsedPayload);
            
            // Extract ID from common fields
            return parsedPayload.id || parsedPayload.userId || parsedPayload.driverId || parsedPayload._id || null;
            
        } catch (error) {
            console.error('Failed to decode JWT token:', error);
            return null;
        }
    }

    /**
     * Get vehicles for a driver with optional filtering
     * API: driver/vehicle?driverId=68b93728af1dd26ef9176dad&filter=nearby
     */
    async getVehicles(filter: VehicleFilter = 'nearby', limit: number = 50): Promise<Vehicle[]> {
        try {
            const driverId = await this.getDriverId();
            if (!driverId) {
                throw new Error('Driver not authenticated');
            }

            const queryParams = new URLSearchParams({
                driverId,
                filter,
                limit: limit.toString()
            });

            const response = await apiService.get<any>(`${this.endpoint}?${queryParams.toString()}`, true);

            console.log('getVehicles API Response:', {
                success: response.success,
                hasData: !!response.data,
                dataType: typeof response.data,
                isArray: Array.isArray(response.data)
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch vehicles');
            }

            // Handle the API response structure based on your example
            let vehicles: Vehicle[] = [];
            
            if (Array.isArray(response.data)) {
                vehicles = response.data;
            } else if (response.data?.data && Array.isArray(response.data.data)) {
                vehicles = response.data.data;
            } else if (response.data?.vehicles && Array.isArray(response.data.vehicles)) {
                vehicles = response.data.vehicles;
            } else {
                console.warn('Unexpected vehicles response format:', response.data);
                vehicles = [];
            }

            console.log(`Retrieved ${vehicles.length} vehicles`);
            return vehicles;

        } catch (error) {
            console.error('getVehicles error:', error);
            return [];
        }
    }

    /**
     * Get selected vehicle details by ID
     * API: driver/selected-vehicle?vehicleId=68b97dd8af1dd26ef9176dc6
     */
    async getSelectedVehicle(vehicleId: string): Promise<{ success: boolean; data?: Vehicle; message?: string }> {
        try {
            logger.info('Fetching selected vehicle', { vehicleId });

            const queryParams = new URLSearchParams({
                vehicleId
            });

            const response = await apiService.get<any>(`${this.selectedVehicleEndpoint}?${queryParams.toString()}`, true);

            console.log('getSelectedVehicle API Response:', {
                success: response.success,
                hasData: !!response.data,
                message: response.message
            });

            if (response.success && response.data) {
                logger.info('Selected vehicle fetched successfully', { vehicleId });
                return {
                    success: true,
                    data: response.data,
                    message: response.message
                };
            } else {
                logger.warn('Selected vehicle not found', { vehicleId, error: response.error });
                return {
                    success: false,
                    message: response.error || 'Vehicle not found'
                };
            }
        } catch (error) {
            logger.error('Error fetching selected vehicle', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Network error while fetching vehicle'
            };
        }
    }

    /**
     * Search vehicles by plate number (frontend search implementation)
     * Shows partial matches - e.g., searching "66" shows vehicles with plates containing "66"
     */
    async searchVehiclesByPlate(plateNumber: string, limit: number = 50): Promise<Vehicle[]> {
        try {
            const driverId = await this.getDriverId();
            if (!driverId) {
                throw new Error('Driver not authenticated');
            }

            if (!plateNumber || plateNumber.trim().length === 0) {
                return this.getVehicles('all', limit);
            }

            // Get all vehicles first
            const allVehicles = await this.getVehicles('all', 1000); // Get more vehicles for search
            
            // Filter by plate number on frontend - partial matches
            const searchTerm = plateNumber.toLowerCase().trim();
            const filteredVehicles = allVehicles.filter(vehicle => 
                vehicle.plateNumber.toLowerCase().includes(searchTerm)
            );

            console.log(`Found ${filteredVehicles.length} vehicles with plate containing: "${plateNumber}"`);
            return filteredVehicles.slice(0, limit); // Limit results

        } catch (error) {
            console.error('searchVehiclesByPlate error:', error);
            return [];
        }
    }

    /**
     * Helper method to filter vehicles by status locally
     */
    filterVehiclesByStatus(vehicles: Vehicle[], status: string): Vehicle[] {
        return vehicles.filter(vehicle => vehicle.status === status);
    }

    /**
     * Helper method to filter vehicles with trailers
     */
    filterVehiclesWithTrailers(vehicles: Vehicle[], hasTrailer?: boolean): Vehicle[] {
        if (hasTrailer === undefined) return vehicles;
        return vehicles.filter(vehicle => vehicle.hasTrailer === hasTrailer);
    }

    /**
     * Helper method to filter vehicles by nearby location
     */
    filterVehiclesNearby(vehicles: Vehicle[], userLat: number = 30.9010, userLng: number = 75.8573, radius: number = 50): Vehicle[] {
        return vehicles.filter(vehicle => {
            if (!vehicle.coordinates?.latitude || !vehicle.coordinates?.longitude) {
                return false;
            }
            
            try {
                const vehicleLat = parseFloat(vehicle.coordinates.latitude);
                const vehicleLng = parseFloat(vehicle.coordinates.longitude);
                const distance = this.calculateDistance(userLat, userLng, vehicleLat, vehicleLng);
                return distance <= radius;
            } catch {
                return false;
            }
        });
    }

    /**
     * Helper method to sort vehicles by creation date
     */
    sortVehiclesByDate(vehicles: Vehicle[], ascending: boolean = false): Vehicle[] {
        return [...vehicles].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return ascending ? dateA - dateB : dateB - dateA;
        });
    }

    /**
     * Helper method to filter vehicles by search term (plate number focus)
     */
    filterVehiclesBySearch(vehicles: Vehicle[], searchTerm: string): Vehicle[] {
        if (!searchTerm.trim()) return vehicles;

        const term = searchTerm.toLowerCase();
        return vehicles.filter(vehicle =>
            vehicle.plateNumber.toLowerCase().includes(term) ||
            vehicle.internalId.toLowerCase().includes(term) ||
            vehicle.vinNumber.toLowerCase().includes(term) ||
            `${vehicle.make} ${vehicle.model}`.toLowerCase().includes(term)
        );
    }

    /**
     * Helper method to calculate distance between two points
     */
    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Radius of the Earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLng = this.deg2rad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

// Export singleton instance
export const vehicleService = new VehicleService();
export default vehicleService;