// hooks/useVehicles.ts
import { useState, useEffect, useCallback } from 'react';
import { Vehicle, VehicleFilter } from '../types/Vehicle';
import { vehicleService } from '../services/VehicleService';

interface UseVehiclesReturn {
    vehicles: Vehicle[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    filterVehicles: (filter: VehicleFilter) => Promise<void>;
    searchVehiclesByPlate: (plateNumber: string) => Promise<void>;
    getSelectedVehicle: (vehicleId: string) => Promise<Vehicle | null>;
    clearError: () => void;
}

export const useVehicles = (initialFilter: VehicleFilter = 'all'): UseVehiclesReturn => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [currentFilter, setCurrentFilter] = useState<VehicleFilter>(initialFilter);

    // User location for nearby filtering (Ludhiana, Punjab)
    const userLocation = { lat: 30.9010, lng: 75.8573 };

    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Fetch vehicles function with proper error handling
    const fetchVehicles = useCallback(async (filter: VehicleFilter = currentFilter) => {
        try {
            setLoading(true);
            clearError();

            console.log('Fetching vehicles with filter:', filter);

            // Always get all vehicles first, then apply filters on frontend
            const result = await vehicleService.getVehicles('all');

            console.log('API Response:', {
                resultType: typeof result,
                isArray: Array.isArray(result),
                count: Array.isArray(result) ? result.length : 0
            });

            // Ensure result is always an array
            let vehiclesData: Vehicle[] = Array.isArray(result) ? result : [];

            // Apply frontend filtering based on the selected filter
            switch (filter) {
                case 'nearby':
                    vehiclesData = vehicleService.filterVehiclesNearby(
                        vehiclesData,
                        userLocation.lat,
                        userLocation.lng,
                        50 // 50km radius
                    );
                    break;
                case 'trailer':
                    vehiclesData = vehicleService.filterVehiclesWithTrailers(vehiclesData, true);
                    break;
                // case 'available':
                //   vehiclesData = vehicleService.filterVehiclesByStatus(vehiclesData, 'available');
                //   break;
                case 'all':
                default:
                    // No additional filtering needed
                    break;
            }

            console.log(`Processed vehicles data: ${vehiclesData.length} vehicles after ${filter} filter`);
            setVehicles(vehiclesData);
            setError(null);

        } catch (err) {
            console.error('Error fetching vehicles:', err);

            const errorMessage = err instanceof Error
                ? err.message
                : typeof err === 'string'
                    ? err
                    : 'Failed to fetch vehicles';

            setError(errorMessage);
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    }, [currentFilter, clearError, userLocation.lat, userLocation.lng]);

    // Refetch function
    const refetch = useCallback(async () => {
        await fetchVehicles(currentFilter);
    }, [fetchVehicles, currentFilter]);

    // Filter vehicles function
    const filterVehicles = useCallback(async (filter: VehicleFilter) => {
        setCurrentFilter(filter);
        await fetchVehicles(filter);
    }, [fetchVehicles]);

    // Search vehicles by plate number function
    const searchVehiclesByPlate = useCallback(async (plateNumber: string) => {
        try {
            setLoading(true);
            clearError();

            console.log('Searching vehicles by plate number:', plateNumber);

            const result = await vehicleService.searchVehiclesByPlate(plateNumber);

            console.log('Search API Response:', {
                resultType: typeof result,
                isArray: Array.isArray(result),
                count: Array.isArray(result) ? result.length : 0
            });

            // Ensure result is always an array
            const vehiclesData: Vehicle[] = Array.isArray(result) ? result : [];

            console.log(`Found ${vehiclesData.length} vehicles matching plate: "${plateNumber}"`);
            setVehicles(vehiclesData);
            setError(null);

        } catch (err) {
            console.error('Error searching vehicles:', err);

            const errorMessage = err instanceof Error
                ? err.message
                : typeof err === 'string'
                    ? err
                    : 'Failed to search vehicles';

            setError(errorMessage);
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    }, [clearError]);

    const getSelectedVehicle = useCallback(async (vehicleId: string): Promise<Vehicle | null> => {
        try {
            setLoading(true);
            clearError();

            console.log('Fetching selected vehicle:', vehicleId);

            const result = await vehicleService.getSelectedVehicle(vehicleId);
            console.log('Raw API Response:', result);

            if (result.success && result.data) {
                console.log('Selected vehicle fetched successfully:', result.data);

                // Return the vehicle data directly, don't set it in the hook
                // The component will handle setting its own state
                return result.data;
            } else {
                console.warn('Failed to fetch selected vehicle:', result.message);
                const errorMsg = result.message || 'Failed to fetch vehicle details';
                setError(errorMsg);
                return null;
            }

        } catch (err) {
            console.error('Error fetching selected vehicle:', err);

            const errorMessage = err instanceof Error
                ? err.message
                : typeof err === 'string'
                    ? err
                    : 'Failed to fetch vehicle details';

            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    }, [clearError]);

    // Initial fetch
    useEffect(() => {
        fetchVehicles(initialFilter);
    }, [initialFilter]); // Only depend on initialFilter to avoid infinite loop

    // Debug logging
    useEffect(() => {
        console.log('useVehicles State Update:', {
            vehiclesCount: vehicles.length,
            vehiclesType: typeof vehicles,
            isArray: Array.isArray(vehicles),
            loading,
            error,
            currentFilter
        });
    }, [vehicles, loading, error, currentFilter]);

    return {
        vehicles,
        loading,
        error,
        refetch,
        filterVehicles,
        searchVehiclesByPlate,
        getSelectedVehicle,
        clearError,
    };
};