// src/services/TrailerService.ts
import { apiService } from './api/apiService';
import { logger } from '../utils/loggerHelper';

export interface Trailer {
    _id: string;
    trailer: string;
    plateNumber: string;
    type: string;
    ownerShip: string;
    operationStatus: string;
    internalId: string;
    speed?: number;
    status?: string;
    capacity?: string;
    isAttached?: boolean;
    company?: string;
    route?: any[];
    currentLocation?: {
        address?: string;
        longitude?: string;
        latitude?: string;
        updatedAt?: string;
    };
    cargoDetails?: {
        weight?: number;
        isRefrigerated?: boolean;
    };
    sensors?: {
        doorStatus?: string;
        shockDetection?: boolean;
        tilting?: boolean;
    };
    maintenance?: {
        tyreCondition?: string;
        brakeCondition?: string;
        issues?: string[];
    };
    lastDispatch?: string;
    lastDropLocation?: string;
    note?: string;
    loadStatus?: string;
    compilance?: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
}

interface TrailerListResponse {
    success: boolean;
    message: string;
    data: Trailer[];
    pagination?: {
        current: number;
        pages: number;
        total: number;
        limit: number;
    };
}

interface SingleTrailerResponse {
    success: boolean;
    message: string;
    data: Trailer;
}

class TrailerService {
    private trailerCache: Trailer[] = [];
    private lastFetchTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Get all trailers for the driver
     */
    async getAllTrailers(forceRefresh: boolean = false): Promise<{
        success: boolean;
        data?: Trailer[];
        error?: string;
    }> {
        try {
            // Check cache first
            const now = Date.now();
            if (!forceRefresh &&
                this.trailerCache.length > 0 &&
                (now - this.lastFetchTime) < this.CACHE_DURATION) {
                logger.info('Returning cached trailers', { count: this.trailerCache.length });
                return {
                    success: true,
                    data: this.trailerCache
                };
            }

            logger.info('Fetching trailers from API');

            const response = await apiService.get<TrailerListResponse>('/driver/trailer');

            if (response.success && response.data?.data) {
                // Cache the results
                this.trailerCache = Array.isArray(response.data.data) ? response.data.data : [];
                this.lastFetchTime = now;

                logger.info('Trailers fetched successfully', {
                    count: this.trailerCache.length
                });

                return {
                    success: true,
                    data: this.trailerCache
                };
            } else {
                const errorMsg = response.error || response.data?.message || 'Failed to fetch trailers';
                logger.error('Failed to fetch trailers', { error: errorMsg });

                return {
                    success: false,
                    error: errorMsg
                };
            }
        } catch (error: any) {
            logger.error('Error in getAllTrailers', error);
            return {
                success: false,
                error: 'An unexpected error occurred while fetching trailers'
            };
        }
    }

    /**
     * Get a specific trailer by ID
     */
    async getTrailerById(trailerId: string): Promise<{
        success: boolean;
        data?: Trailer;
        error?: string;
    }> {
        try {
            if (!trailerId || trailerId.trim() === '') {
                return {
                    success: false,
                    error: 'Trailer ID is required'
                };
            }

            logger.info('Fetching trailer details', { trailerId });

            const response = await apiService.get<SingleTrailerResponse>(`/driver/selected-trailer?trailerId=${trailerId}`);

            if (response.success && response.data?.data) {
                logger.info('Trailer details fetched successfully', {
                    trailerId,
                    trailer: response.data.data.trailer
                });

                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                const errorMsg = response.error || response.data?.message || 'Failed to fetch trailer details';
                logger.error('Failed to fetch trailer details', { trailerId, error: errorMsg });

                return {
                    success: false,
                    error: errorMsg
                };
            }
        } catch (error: any) {
            logger.error('Error in getTrailerById', { trailerId, error });
            return {
                success: false,
                error: 'An unexpected error occurred while fetching trailer details'
            };
        }
    }

    /**
     * Search trailers by plate number or trailer name
     */
    async searchTrailers(searchQuery: string): Promise<{
        success: boolean;
        data?: Trailer[];
        error?: string;
    }> {
        try {
            // First get all trailers
            const allTrailersResult = await this.getAllTrailers();

            if (!allTrailersResult.success || !allTrailersResult.data) {
                return allTrailersResult;
            }

            const query = searchQuery.toLowerCase().trim();

            if (query === '') {
                return {
                    success: true,
                    data: allTrailersResult.data
                };
            }

            // Filter trailers based on search query
            const filteredTrailers = allTrailersResult.data.filter(trailer =>
                trailer.plateNumber.toLowerCase().includes(query) ||
                trailer.trailer.toLowerCase().includes(query)
            );

            logger.info('Trailers filtered', {
                searchQuery: query,
                totalTrailers: allTrailersResult.data.length,
                filteredCount: filteredTrailers.length
            });

            return {
                success: true,
                data: filteredTrailers
            };
        } catch (error: any) {
            logger.error('Error in searchTrailers', { searchQuery, error });
            return {
                success: false,
                error: 'An unexpected error occurred while searching trailers'
            };
        }
    }

    /**
     * Get trailer status display text
     */
    getStatusText(loadStatus?: string, operationStatus?: string): string {
        if (!operationStatus) {
            return 'Unknown';
        }

        const opStatus = operationStatus.toLowerCase();
        
        switch (opStatus) {
            case 'available':
                return 'Available';
            case 'in_transit':
            case 'in-transit':
                return 'In Transit';
            case 'maintenance':
                return 'In Maintenance';
            case 'out_of_service':
                return 'Out of Service';
            default:
                return operationStatus.charAt(0).toUpperCase() + operationStatus.slice(1);
        }
    }

    /**
     * Get trailer status color
     */
    getStatusColor(loadStatus?: string, operationStatus?: string): string {
        if (!operationStatus) {
            return '#666';
        }

        const opStatus = operationStatus.toLowerCase();
        
        switch (opStatus) {
            case 'available':
                return '#10B981'; // Green
            case 'in_transit':
            case 'in-transit':
                return '#F59E0B'; // Yellow/Orange
            case 'maintenance':
                return '#EF4444'; // Red
            case 'out_of_service':
                return '#6B7280'; // Gray
            default:
                return '#666';
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.trailerCache = [];
        this.lastFetchTime = 0;
        logger.info('Trailer cache cleared');
    }

    /**
     * Get cached trailers count
     */
    getCachedTrailersCount(): number {
        return this.trailerCache.length;
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(): boolean {
        const now = Date.now();
        return this.trailerCache.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION;
    }
}

// Singleton instance
export const trailerService = new TrailerService();
export default trailerService;