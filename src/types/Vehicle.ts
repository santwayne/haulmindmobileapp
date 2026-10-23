// types/Vehicle.ts

export interface Coordinates {
    longitude: string;
    latitude: string;
}

export interface TrailerDetails {
    serialNumber: string;
    capacity: string;
    status: string;
}

export interface Vehicle {
    _id: string;
    internalId: string;
    plateNumber: string;
    vinNumber: string;
    make: string;
    model: string;
    year: number;
    status: 'available' | 'in-use' | 'maintenance' | 'unavailable';
    coordinates: Coordinates;
    trailerDetails: TrailerDetails;
    vehicleImage: string[];
    documents: string[];
    hasTrailer: boolean;
    createdAt: string;
    updatedAt: string;
    __v: number;
}

export interface VehicleListResponse {
    success: boolean;
    message: string;
    data: Vehicle[];
}

// Updated to include only the required filter types
export type VehicleFilter = 'all' | 'nearby' | 'trailer';

export interface SelectedVehicleResponse {
    success: boolean;
    message: string;
    data: {
        coordinates: {
            longitude: string;
            latitude: string;
        };
        trailerDetails: {
            serialNumber: string;
            capacity: string;
            status: string;
        };
        _id: string;
        internalId: string;
        plateNumber: string;
        vinNumber: string;
        make: string;
        model: string;
        year: number;
        status: string;
        vehicleImage: string[];
        documents: string[];
        hasTrailer: boolean;
        createdAt: string;
        updatedAt: string;
        __v: number;
    };
}

export interface VehicleQueryParams {
    driverId: string;
    filter?: VehicleFilter;
    limit?: number;
    offset?: number;
    status?: string;
    location?: {
        latitude: number;
        longitude: number;
        radius?: number; // in kilometers
    };
}