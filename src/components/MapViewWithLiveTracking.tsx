import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { socketService, VehicleLocation } from '../services/socket/socketService';
import { logger } from '../utils/loggerHelper';
import { API_BASE_URL, GOOGLE_MAPS_API_KEY } from '../config/env';
import { apiService } from '../services/api/apiService';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';

// Conditionally import react-native-maps only on native platforms
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let UrlTile: any = null;
let PROVIDER_GOOGLE: any = null;

// Only import on native platforms - Metro will use web stub on web
try {
  const mapsModule = require('react-native-maps');
  if (mapsModule && mapsModule.default) {
    MapView = mapsModule.default;
    Marker = mapsModule.Marker;
    Polyline = mapsModule.Polyline;
    UrlTile = mapsModule.UrlTile;
    PROVIDER_GOOGLE = mapsModule.PROVIDER_GOOGLE;
  }
} catch (error) {
  // Silently handle - web stub will be used instead
  if (Platform.OS !== 'web') {
    console.warn('react-native-maps not available:', error);
  }
}

const { width, height } = Dimensions.get('window');
const SPEED_WARNING_THRESHOLD_KMH = 105;
const FUEL_WARNING_THRESHOLD_PERCENT = 10;
const FUEL_WARNING_THRESHOLD_LITERS = 40;
const ENABLE_SPEED_WARNING_DEMO =
  typeof process !== 'undefined' &&
  process?.env?.EXPO_PUBLIC_ENABLE_SPEED_WARNING_DEMO === 'true'
    ? true
    : __DEV__;

// Helper function to safely convert latitude/longitude to numbers
const parseCoordinate = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseNumericValue = (value: number | string | undefined | null): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};
const parseSpeed = (value: number | string | undefined | null): number | null =>
  parseNumericValue(value);
const parseFuelValue = (value: number | string | undefined | null): number | null =>
  parseNumericValue(value);

const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

// Calculate distance between two coordinates using Haversine formula (in kilometers)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface MapViewWithLiveTrackingProps {
  visible: boolean;
  onClose: () => void;
  load: {
    _id: string;
    internalId?: string;
    route?: {
      multipleDropOffs?: boolean;
      selectPickup?: {
        place?: string;
        city?: string;
        state?: string;
        latitude?: number | string;
        longitude?: number | string;
      };
      selectDropOff?: {
        place?: string;
        city?: string;
        state?: string;
        latitude?: number | string;
        longitude?: number | string;
      };
      wayPoints?: Array<{
        address?: {
          place?: string;
          city?: string;
          state?: string;
          latitude?: number | string;
          longitude?: number | string;
        };
        dropOff?: boolean;
        pickup?: boolean;
      }>;
    };
    vehicle?: {
      _id: string;
      internalId: string;
      plateNumber?: string;
      trackingKey?: string;
    };
    yardLocation?: {
      yardName?: string;
      yardCode?: string;
      address?: string;
      city?: string;
      stateProvince?: string;
      coordinates?: {
        latitude?: number | string;
        longitude?: number | string;
      };
    };
  };
}

type WarningBannerType = 'speed' | 'fuel';

interface WarningBannerConfig {
  id: string;
  type: WarningBannerType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  note?: string;
}

const MapViewWithLiveTracking: React.FC<MapViewWithLiveTrackingProps> = ({
  visible,
  onClose,
  load,
}) => {
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showDistanceInfo, setShowDistanceInfo] = useState(true);
  const [forceWarningDemo, setForceWarningDemo] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayoutReady, setMapLayoutReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const mapRef = useRef<any>(null);
  const [routePath, setRoutePath] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const googleMapsApiKeyRef = useRef<string | null | undefined>(undefined);

  // Validate load data early
  if (!load) {
  return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Map View</Text>
          </View>
          <View style={styles.mapFallback}>
            <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
            <Text style={styles.fallbackText}>Invalid Load Data</Text>
            <Text style={styles.fallbackSubtext}>Load information is not available.</Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Validate route data
  if (!load.route) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Map View</Text>
          </View>
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={64} color="#8B5CF6" />
            <Text style={styles.fallbackText}>Route Not Available</Text>
            <Text style={styles.fallbackSubtext}>Route information is not available for this load.</Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const multipleDropOffs = load.route?.multipleDropOffs || false;
  const wayPoints = load.route?.wayPoints || [];
  
  // For multiple dropoffs, pickup might be in wayPoints instead of selectPickup
  // Find pickup waypoint if multipleDropOffs is true and selectPickup doesn't exist
  let pickup = load.route?.selectPickup;
  if (multipleDropOffs && !pickup && wayPoints.length > 0) {
    const pickupWaypoint = wayPoints.find(wp => wp.pickup === true);
    if (pickupWaypoint && pickupWaypoint.address) {
      pickup = pickupWaypoint.address;
      logger.info('Pickup found in waypoints', {
        waypointIndex: wayPoints.indexOf(pickupWaypoint),
        place: pickupWaypoint.address.place,
        hasCoordinates: !!(pickupWaypoint.address.latitude && pickupWaypoint.address.longitude)
      });
    }
  }
  
  const dropoff = load.route?.selectDropOff;
  // Use trackingKey if available (for Samsara/telematics tracking), otherwise fallback to internalId
  const vehicleId = load.vehicle?.trackingKey || load.vehicle?.internalId;
  
  console.log('🚗 Vehicle tracking info:', {
    hasVehicle: !!load.vehicle,
    trackingKey: load.vehicle?.trackingKey,
    internalId: load.vehicle?.internalId,
    usingForTracking: vehicleId,
    vehicleData: load.vehicle
  });

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setVehicleLocation(null);
      setError(null);
      if (ENABLE_SPEED_WARNING_DEMO) {
        setForceWarningDemo(false);
      }
      socketService.leaveVehicle();
      socketService.offVehicleLocation();
      return;
    }

    // Initialize socket and join vehicle room
    const initializeTracking = async () => {
      try {
        setLoading(true);
        setError(null);

        // On web platform, skip socket connection entirely - we only use Google Maps
        if (Platform.OS === 'web') {
          logger.info('Web platform detected - skipping socket connection, using Google Maps only');
          setLoading(false);
          // Don't set error - map will show route with Google Maps
          return; // Exit early - Google Maps will handle the display
        }

        // Initialize socket connection (native platforms only)
        // Use shorter timeout and don't block map rendering
        if (!socketService.isSocketConnected()) {
          try {
            // Use 5 second timeout for faster failure
            await Promise.race([
              socketService.initialize(5000),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 5000)
              )
            ]);
            logger.info('Socket connection established');
          } catch (connError: any) {
            logger.error('Failed to connect to socket', connError);
            const errorMessage = connError.message || 'Unknown connection error';
            
            // Provide more helpful error messages but don't throw - allow map to render
            let userFriendlyError = 'Live tracking unavailable';
            if (errorMessage.includes('timeout') || errorMessage.includes('Connection timeout')) {
              userFriendlyError = 'Live tracking unavailable: Connection timeout. The map will still show the route.';
            } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to fetch')) {
              userFriendlyError = 'Live tracking unavailable: Cannot reach server. The map will still show the route.';
            } else {
              userFriendlyError = `Live tracking unavailable: ${errorMessage.split('\n')[0]}. The map will still show the route.`;
            }
            
            // Don't throw - just set error and continue
            setError(userFriendlyError);
            setLoading(false);
            
            // Exit early - map will still render with route
            return;
          }
        }

        // Verify connection is actually established
        if (!socketService.isSocketConnected()) {
          setError('Socket connection not established. Map will show route only.');
          setLoading(false);
          return; // Exit early - map will still render with route
        }

        // Join vehicle room if vehicle ID is available
        if (vehicleId) {
          logger.info('Joining vehicle for live tracking', { vehicleId });
          
          let locationReceived = false;
          let isFirstLocationUpdate = true;
          const timeoutId = setTimeout(() => {
            if (!locationReceived) {
              setLoading(false);
              setError('No location data received. The vehicle may be offline.');
              console.warn('⚠️ Socket: No location data received within 10 seconds');
            }
          }, 10000);
          
          // IMPORTANT: Set up listener BEFORE joining the vehicle room
          // This ensures we catch the initial location update
          socketService.onVehicleLocation((vehicle: VehicleLocation) => {
            if (!locationReceived) {
              console.log('✅ Socket: Vehicle location updates working');
              console.log('📍 First vehicle location received:', {
                vehicleId: vehicle._id,
                internalId: vehicle.internalId,
                hasLocation: !!(vehicle.currentLocation?.latitude && vehicle.currentLocation?.longitude),
                location: vehicle.currentLocation,
                speed: vehicle.speed,
                fuelLevel: vehicle.fuelLevel
              });
              locationReceived = true;
            }
            setVehicleLocation(vehicle);
            setLoading(false);
            clearTimeout(timeoutId);
            
            logger.debug('Vehicle location update received', {
              vehicleId: vehicle._id,
              internalId: vehicle.internalId,
              plateNumber: vehicle.plateNumber,
              latitude: vehicle.currentLocation?.latitude,
              longitude: vehicle.currentLocation?.longitude,
              speed: vehicle.speed,
            }, 'MapViewWithLiveTracking');

            const numericSpeed = parseSpeed(vehicle.speed ?? null);
            if (numericSpeed !== null && numericSpeed > SPEED_WARNING_THRESHOLD_KMH) {
              logger.warn('Vehicle speed exceeded threshold', {
                vehicleId: vehicle._id,
                internalId: vehicle.internalId,
                plateNumber: vehicle.plateNumber,
                speedKmh: numericSpeed,
                thresholdKmh: SPEED_WARNING_THRESHOLD_KMH,
              }, 'MapViewWithLiveTracking');
            }

            const numericFuelPercent = parseFuelValue(
              vehicle.fuel?.percentage ??
              vehicle.fuelLevelPercentage ??
              (vehicle as any)?.fuelPercentage ??
              null
            );
            let numericFuelLiters = parseFuelValue(
              vehicle.fuel?.liters ??
              vehicle.fuel?.litres ??
              vehicle.fuelLevelLitres ??
              vehicle.fuelLevelLiters ??
              (vehicle as any)?.fuelLiters ??
              null
            );
            if (numericFuelLiters === null) {
              const gallonsValue = parseFuelValue(
                vehicle.fuel?.gallons ?? (vehicle as any)?.fuelGallons ?? null
              );
              if (gallonsValue !== null) {
                numericFuelLiters = gallonsValue * 3.78541;
              }
            }
            if (
              (numericFuelPercent !== null && numericFuelPercent <= FUEL_WARNING_THRESHOLD_PERCENT) ||
              (numericFuelPercent === null &&
                numericFuelLiters !== null &&
                numericFuelLiters <= FUEL_WARNING_THRESHOLD_LITERS)
            ) {
              logger.warn('Vehicle fuel below threshold', {
                vehicleId: vehicle._id,
                internalId: vehicle.internalId,
                plateNumber: vehicle.plateNumber,
                fuelPercentage: numericFuelPercent,
                fuelLiters: numericFuelLiters,
                thresholdPercent: FUEL_WARNING_THRESHOLD_PERCENT,
                thresholdLiters: FUEL_WARNING_THRESHOLD_LITERS,
              }, 'MapViewWithLiveTracking');
            }
            
            // Update map camera to show vehicle (only on first update to avoid constant movement)
            const vehicleLat = parseCoordinate(vehicle.currentLocation?.latitude);
            const vehicleLng = parseCoordinate(vehicle.currentLocation?.longitude);
            if (vehicleLat !== null && vehicleLng !== null && mapRef.current) {
              if (isFirstLocationUpdate) {
                // Animate to vehicle location on first update
                mapRef.current.animateToRegion({
                  latitude: vehicleLat,
                  longitude: vehicleLng,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }, 1000);
                isFirstLocationUpdate = false;
              }
              // Subsequent updates will just move the marker, camera stays stable
            }
          });
          
          // Now join the vehicle room - this will trigger the backend to start sending updates
          console.log('🚗 Calling joinVehicle with:', {
            vehicleId,
            isTrackingKey: load.vehicle?.trackingKey === vehicleId,
            trackingKey: load.vehicle?.trackingKey,
            internalId: load.vehicle?.internalId
          });
          socketService.joinVehicle(vehicleId);
          
          // Clear timeout on cleanup
          return () => {
            clearTimeout(timeoutId);
            socketService.offVehicleLocation();
          };
        } else {
          setLoading(false);
          setError('No vehicle assigned to this load.');
        }

      } catch (err: any) {
        logger.error('Error initializing live tracking', err);
        const errorMsg = err.message || 'Failed to initialize live tracking';
        setError(errorMsg);
        setLoading(false);
        
        // Even if socket fails, we can still show the route map
        // The error will be displayed but map will be usable
        console.warn('⚠️ Socket connection failed, but map can still display route information');
      }
    };

    initializeTracking();

    // Cleanup on unmount
    return () => {
      socketService.leaveVehicle();
      socketService.offVehicleLocation();
    };
  }, [visible, vehicleId]);

  // Ensure map region is set when modal becomes visible
  useEffect(() => {
    if (visible && mapRef.current) {
      const region = calculateRegion();
      console.log('🔄 Modal visible, setting map region:', region);
      if (region && !isNaN(region.latitude) && !isNaN(region.longitude)) {
        // Small delay to ensure MapView is fully mounted
        setTimeout(() => {
          if (mapRef.current) {
            console.log('📍 Animating map to region:', region);
            mapRef.current.animateToRegion(region, 500);
          }
        }, 100);
      } else {
        console.error('❌ Cannot set map region - invalid coordinates:', region);
      }
    }
  }, [visible, load?._id]);

  // iOS-specific fix: Enable gestures after map is ready and layout is complete
  useEffect(() => {
    if (Platform.OS === 'ios' && mapReady && mapLayoutReady && mapRef.current) {
      // Small delay to ensure gesture recognizers are properly initialized
      const timer = setTimeout(() => {
        if (mapRef.current) {
          console.log('✅ iOS: Enabling map gestures after initialization');
          // Force a small region update to activate gesture recognizers
          const region = calculateRegion();
          if (region && !isNaN(region.latitude) && !isNaN(region.longitude)) {
            mapRef.current.setCamera({
              center: {
                latitude: region.latitude,
                longitude: region.longitude,
              },
              zoom: region.latitudeDelta ? Math.log2(360 / region.latitudeDelta) : 10,
            });
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mapReady, mapLayoutReady]);

  // Add timeout for map loading
  useEffect(() => {
    if (visible && mapLoading) {
      const timeout = setTimeout(() => {
        if (mapLoading) {
          console.warn('⚠️ Map loading timeout - map may not be initializing');
          setMapError('Map is taking too long to load. Please check your internet connection and API key.');
          setMapLoading(false);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [visible, mapLoading]);

  // Inside your component
useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active' && mapRef.current) {
      // Force a tiny region shift to wake up the map rendering
      const currentRegion = calculateRegion();
      mapRef.current.animateToRegion(currentRegion, 100);
    }
  });
  return () => subscription.remove();
}, []);

  // Fullscreen toggle handler for iOS - forces map re-render to fix freeze issue
  const handleFullScreenToggle = useCallback(() => {
    setIsFullScreen((prev) => {
      const newValue = !prev;
      // Force map re-render when toggling fullscreen
      if (mapRef.current && Platform.OS === 'ios') {
        setTimeout(() => {
          const currentRegion = calculateRegion();
          mapRef.current.animateToRegion(currentRegion, 100);
        }, 50);
      }
      return newValue;
    });
  }, []);

  // Calculate map region to fit all markers
  const calculateRegion = () => {
    const coordinates: Array<{ latitude: number; longitude: number }> = [];

    // Add yard location as starting point (if vehicle location is not available)
    const yardLat = parseCoordinate(load.yardLocation?.coordinates?.latitude);
    const yardLng = parseCoordinate(load.yardLocation?.coordinates?.longitude);
    if (yardLat !== null && yardLng !== null) {
      coordinates.push({
        latitude: yardLat,
        longitude: yardLng,
      });
    }

    // Add pickup location (either from selectPickup or from waypoint with pickup: true)
    const pickupLat = parseCoordinate(pickup?.latitude);
    const pickupLng = parseCoordinate(pickup?.longitude);
    if (pickupLat !== null && pickupLng !== null) {
      coordinates.push({
        latitude: pickupLat,
        longitude: pickupLng,
      });
    }

    // Add waypoints if multipleDropOffs is true
    if (multipleDropOffs && wayPoints.length > 0) {
      wayPoints.forEach((waypoint) => {
        // Skip if this waypoint is the pickup (already added above)
        if (waypoint.pickup === true && pickup) {
          return;
        }
        
        // Try multiple ways to get coordinates
        let waypointLat = parseCoordinate(waypoint.address?.latitude);
        let waypointLng = parseCoordinate(waypoint.address?.longitude);
        
        // If not found in address, try direct on waypoint
        if (waypointLat === null || waypointLng === null) {
          waypointLat = parseCoordinate((waypoint as any)?.latitude);
          waypointLng = parseCoordinate((waypoint as any)?.longitude);
        }
        
        // If still not found, try coordinates array
        if ((waypointLat === null || waypointLng === null) && (waypoint.address as any)?.coordinates) {
          const coords = (waypoint.address as any).coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            waypointLng = parseCoordinate(coords[0]); // longitude first in GeoJSON
            waypointLat = parseCoordinate(coords[1]); // latitude second in GeoJSON
          }
        }
        
        if (waypointLat !== null && waypointLng !== null) {
          coordinates.push({
            latitude: waypointLat,
            longitude: waypointLng,
          });
        }
      });
    } else {
      // Add dropoff location only if not multiple drops
      const dropoffLat = parseCoordinate(dropoff?.latitude);
      const dropoffLng = parseCoordinate(dropoff?.longitude);
      if (dropoffLat !== null && dropoffLng !== null) {
        coordinates.push({
          latitude: dropoffLat,
          longitude: dropoffLng,
        });
      }
    }

    // Add vehicle location if available
    const vehicleLat = parseCoordinate(vehicleLocation?.currentLocation?.latitude);
    const vehicleLng = parseCoordinate(vehicleLocation?.currentLocation?.longitude);
    if (vehicleLat !== null && vehicleLng !== null) {
      coordinates.push({ latitude: vehicleLat, longitude: vehicleLng });
    }

    if (coordinates.length === 0) {
      // Default to a reasonable location (e.g., center of US)
      return {
        latitude: 39.8283,
        longitude: -98.5795,
        latitudeDelta: 10,
        longitudeDelta: 10,
      };
    }

    // Calculate bounds
    const minLat = Math.min(...coordinates.map(c => c.latitude));
    const maxLat = Math.max(...coordinates.map(c => c.latitude));
    const minLng = Math.min(...coordinates.map(c => c.longitude));
    const maxLng = Math.max(...coordinates.map(c => c.longitude));

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.05);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.05);

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  // Parse coordinates first
  const pickupLat = parseCoordinate(pickup?.latitude);
  const pickupLng = parseCoordinate(pickup?.longitude);
  const dropoffLat = parseCoordinate(dropoff?.latitude);
  const dropoffLng = parseCoordinate(dropoff?.longitude);

  // Validate that we have at least pickup coordinates before rendering map
  if (pickupLat === null || pickupLng === null) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Map View</Text>
          </View>
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={64} color="#8B5CF6" />
            <Text style={styles.fallbackText}>Route Coordinates Missing</Text>
            <Text style={styles.fallbackSubtext}>
              Pickup location coordinates are not available for this load. Please contact support.
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={onClose}>
              <Text style={styles.errorButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Build route coordinates based on multipleDropOffs flag
  const routeCoordinates: Array<{ latitude: number; longitude: number }> = useMemo(() => {
    const coords: Array<{ latitude: number; longitude: number }> = [];

    // Add pickup first (either from selectPickup or from waypoint with pickup: true)
    if (pickupLat !== null && pickupLng !== null) {
      coords.push({
        latitude: pickupLat,
        longitude: pickupLng,
      });
    }

    if (multipleDropOffs && wayPoints.length > 0) {
      // Use waypoints in the order they were provided (already optimized by convertTripToLoadForMap)
      // Order: All pickups first, then all deliveries (maintaining order within each group)
      wayPoints.forEach((waypoint) => {
        // Skip if this waypoint is the pickup and we already added it
        if (waypoint.pickup === true && pickup && 
            parseCoordinate(waypoint.address?.latitude) === pickupLat &&
            parseCoordinate(waypoint.address?.longitude) === pickupLng) {
          return;
        }
        
        // Try multiple ways to get coordinates
        let waypointLat = parseCoordinate(waypoint.address?.latitude);
        let waypointLng = parseCoordinate(waypoint.address?.longitude);
        
        // If not found in address, try direct on waypoint
        if (waypointLat === null || waypointLng === null) {
          waypointLat = parseCoordinate((waypoint as any)?.latitude);
          waypointLng = parseCoordinate((waypoint as any)?.longitude);
        }
        
        // If still not found, try coordinates array
        if ((waypointLat === null || waypointLng === null) && (waypoint.address as any)?.coordinates) {
          const coords = (waypoint.address as any).coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            waypointLng = parseCoordinate(coords[0]); // longitude first in GeoJSON
            waypointLat = parseCoordinate(coords[1]); // latitude second in GeoJSON
          }
        }
        
        if (waypointLat !== null && waypointLng !== null) {
          coords.push({
            latitude: waypointLat,
            longitude: waypointLng,
          });
        }
      });
    } else if (dropoffLat !== null && dropoffLng !== null) {
      coords.push({
        latitude: dropoffLat,
        longitude: dropoffLng,
      });
    }

    return coords;
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, multipleDropOffs, wayPoints, pickup]);

  // Prepare valid waypoints for rendering (filter out invalid coordinates)
  // Use useMemo to ensure stable array reference - defined early so it can be used in useEffect
  const validWaypoints = useMemo(() => {
    // Show waypoints if we have them, regardless of multipleDropOffs flag
    // This ensures stops are shown even for single orders with additional stops
    console.log('🔍 Processing waypoints for map:', {
      hasWayPoints: !!wayPoints,
      wayPointsLength: wayPoints?.length || 0,
      wayPoints: wayPoints,
      multipleDropOffs
    });
    
    if (!wayPoints || wayPoints.length === 0) {
      console.warn('⚠️ No waypoints provided to map component');
      return [];
    }

    const valid = wayPoints
      .map((waypoint, originalIndex) => {
        console.log(`🔍 Processing waypoint ${originalIndex}:`, {
          waypoint,
          hasAddress: !!waypoint.address,
          address: waypoint.address,
          stopNumber: (waypoint as any).stopNumber,
          stopType: (waypoint as any).stopType,
        });
        
        // Try multiple ways to get coordinates
        // 1. From waypoint.address.latitude/longitude (most common)
        // 2. From waypoint.latitude/longitude (direct on waypoint)
        // 3. From waypoint.address.coordinates (if stored as array)
        let waypointLat = parseCoordinate(waypoint.address?.latitude);
        let waypointLng = parseCoordinate(waypoint.address?.longitude);
        
        console.log(`  📍 Initial coords from address:`, {
          lat: waypointLat,
          lng: waypointLng,
          addressLat: waypoint.address?.latitude,
          addressLng: waypoint.address?.longitude,
        });
        
        // If not found in address, try direct on waypoint
        if (waypointLat === null || waypointLng === null) {
          waypointLat = parseCoordinate((waypoint as any)?.latitude);
          waypointLng = parseCoordinate((waypoint as any)?.longitude);
          console.log(`  📍 Tried direct on waypoint:`, { lat: waypointLat, lng: waypointLng });
        }
        
        // If still not found, try coordinates array
        if ((waypointLat === null || waypointLng === null) && (waypoint.address as any)?.coordinates) {
          const coords = (waypoint.address as any).coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            waypointLng = parseCoordinate(coords[0]); // longitude first in GeoJSON
            waypointLat = parseCoordinate(coords[1]); // latitude second in GeoJSON
            console.log(`  📍 Tried coordinates array:`, { lat: waypointLat, lng: waypointLng });
          }
        }
        
        // Log warning if coordinates are missing
        if (waypointLat === null || waypointLng === null) {
          console.error(`❌ Waypoint ${originalIndex} missing coordinates:`, {
            waypointIndex: originalIndex,
            hasAddress: !!waypoint.address,
            addressKeys: waypoint.address ? Object.keys(waypoint.address) : [],
            waypointKeys: Object.keys(waypoint),
            place: waypoint.address?.place,
            stopNumber: (waypoint as any).stopNumber,
            stopType: (waypoint as any).stopType,
            fullWaypoint: waypoint,
          });
          logger.warn('Waypoint missing coordinates', {
            waypointIndex: originalIndex,
            hasAddress: !!waypoint.address,
            addressKeys: waypoint.address ? Object.keys(waypoint.address) : [],
            waypointKeys: Object.keys(waypoint),
            place: waypoint.address?.place,
          });
          return null;
        }

        console.log(`✅ Waypoint ${originalIndex} has valid coordinates:`, {
          lat: waypointLat,
          lng: waypointLng,
          place: waypoint.address?.place,
          stopNumber: (waypoint as any).stopNumber,
          stopType: (waypoint as any).stopType,
        });

        return {
          waypoint,
          waypointLat,
          waypointLng,
          originalIndex,
          isDropoff: waypoint.dropOff === true,
          isPickup: waypoint.pickup === true,
          stopNumber: (waypoint as any).stopNumber,
          stopType: (waypoint as any).stopType || 'main',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    
    console.log('🗺️ Valid waypoints summary:', {
      totalWaypoints: wayPoints.length,
      validWaypoints: valid.length,
      invalidCount: wayPoints.length - valid.length,
      multipleDropOffs,
      waypointsWithStops: valid.filter(w => w.stopType === 'additional').length,
      validWaypointsDetails: valid.map(w => ({ 
        place: w.waypoint.address?.place, 
        stopNumber: w.stopNumber, 
        stopType: w.stopType,
        isPickup: w.isPickup,
        isDropoff: w.isDropoff,
        coords: [w.waypointLat, w.waypointLng]
      }))
    });
    
    logger.info('Valid waypoints prepared', {
      totalWaypoints: wayPoints.length,
      validWaypoints: valid.length,
      multipleDropOffs,
      waypointsWithStops: valid.filter(w => w.stopType === 'additional').length,
    });
    
    return valid;
  }, [multipleDropOffs, wayPoints]);

  const vehicleLat = parseCoordinate(vehicleLocation?.currentLocation?.latitude);
  const vehicleLng = parseCoordinate(vehicleLocation?.currentLocation?.longitude);
  const vehicleLocationLabel = useMemo(() => {
    if (vehicleLocation?.currentLocation?.address) {
      return vehicleLocation.currentLocation.address;
    }
    const lat = parseCoordinate(vehicleLocation?.currentLocation?.latitude);
    const lng = parseCoordinate(vehicleLocation?.currentLocation?.longitude);
    if (lat !== null && lng !== null) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    if (vehicleLocation?.plateNumber) {
      return vehicleLocation.plateNumber;
    }
    return 'Location unavailable';
  }, [vehicleLocation]);

  const vehicleCoordinates = vehicleLat !== null && vehicleLng !== null
    ? {
        latitude: vehicleLat,
        longitude: vehicleLng,
      }
    : null;

  const currentSpeedKmh = useMemo(() => parseSpeed(vehicleLocation?.speed ?? null), [vehicleLocation?.speed]);
  const isSpeedDemoActive = ENABLE_SPEED_WARNING_DEMO && forceWarningDemo;
  const isFuelDemoActive = isSpeedDemoActive;
  const effectiveSpeedKmh = useMemo(() => {
    if (isSpeedDemoActive) {
      return SPEED_WARNING_THRESHOLD_KMH + 5;
    }
    return currentSpeedKmh;
  }, [isSpeedDemoActive, currentSpeedKmh]);
  const speedDisplayText = effectiveSpeedKmh !== null ? effectiveSpeedKmh.toFixed(1) : '0.0';
  const speedDisplayWithUnit = `${speedDisplayText} km/h`;
  const isSpeedWarningActive = effectiveSpeedKmh !== null && effectiveSpeedKmh > SPEED_WARNING_THRESHOLD_KMH;
  const speedWarningExcessValue = isSpeedWarningActive && effectiveSpeedKmh !== null
    ? Math.max(0, Math.ceil(effectiveSpeedKmh - SPEED_WARNING_THRESHOLD_KMH))
    : null;
  const speedLimitWithUnit = `${SPEED_WARNING_THRESHOLD_KMH} km/h`;
  const rawFuelPercentage = useMemo(() => {
    const sources: Array<number | string | null | undefined> = [
      vehicleLocation?.fuel?.percentage,
      vehicleLocation?.fuelLevelPercentage,
      (vehicleLocation as any)?.fuelPercentage,
      vehicleLocation?.fuelLevel,
      vehicleLocation?.fuel?.level,
    ];
    for (const source of sources) {
      const parsed = parseFuelValue(source ?? null);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }, [vehicleLocation]);
  const rawFuelLiters = useMemo(() => {
    const literSources: Array<number | string | null | undefined> = [
      vehicleLocation?.fuel?.liters,
      vehicleLocation?.fuel?.litres,
      vehicleLocation?.fuelLevelLitres,
      vehicleLocation?.fuelLevelLiters,
      (vehicleLocation as any)?.fuelLiters,
    ];
    for (const source of literSources) {
      const parsed = parseFuelValue(source ?? null);
      if (parsed !== null) {
        return parsed;
      }
    }

    const gallonSources: Array<number | string | null | undefined> = [
      vehicleLocation?.fuel?.gallons,
      (vehicleLocation as any)?.fuelGallons,
    ];
    for (const source of gallonSources) {
      const parsedGallons = parseFuelValue(source ?? null);
      if (parsedGallons !== null) {
        return parsedGallons * 3.78541; // convert to litres
      }
    }

    return null;
  }, [vehicleLocation]);
  const fuelPercentage = useMemo(() => {
    if (rawFuelPercentage === null) {
      return null;
    }
    return Math.min(100, Math.max(0, rawFuelPercentage));
  }, [rawFuelPercentage]);
  const fuelLiters = useMemo(() => {
    if (rawFuelLiters === null) {
      return null;
    }
    return Math.max(0, rawFuelLiters);
  }, [rawFuelLiters]);
  const baseFuelWarningActive =
    (fuelPercentage !== null && fuelPercentage <= FUEL_WARNING_THRESHOLD_PERCENT) ||
    (fuelPercentage === null && fuelLiters !== null && fuelLiters <= FUEL_WARNING_THRESHOLD_LITERS);
  const isFuelWarningActive = baseFuelWarningActive || isFuelDemoActive;
  const fuelDisplayPercentage = useMemo(() => {
    if (fuelPercentage === null) {
      return null;
    }
    return `${fuelPercentage.toFixed(1)}%`;
  }, [fuelPercentage]);
  const fuelDisplayLiters = useMemo(() => {
    if (fuelLiters === null) {
      return null;
    }
    return `${fuelLiters.toFixed(1)} L`;
  }, [fuelLiters]);
  const fuelDisplayText = useMemo(() => {
    const parts: string[] = [];
    if (fuelDisplayPercentage) {
      parts.push(fuelDisplayPercentage);
    }
    if (fuelDisplayLiters) {
      parts.push(fuelDisplayLiters);
    }
    if (parts.length === 0) {
      return null;
    }
    return parts.join(' · ');
  }, [fuelDisplayPercentage, fuelDisplayLiters]);
  const fuelThresholdDescription = `${FUEL_WARNING_THRESHOLD_PERCENT}% or ${FUEL_WARNING_THRESHOLD_LITERS} L`;
  const fuelDisplayTextForUi = useMemo(() => {
    if (isFuelDemoActive) {
      if (fuelDisplayText) {
        return fuelDisplayText.includes('demo') ? fuelDisplayText : `${fuelDisplayText} (demo)`;
      }
      return `${Math.max(0, FUEL_WARNING_THRESHOLD_PERCENT - 2).toFixed(1)}% · ${(FUEL_WARNING_THRESHOLD_LITERS - 5).toFixed(1)} L (demo)`;
    }
    return fuelDisplayText;
  }, [isFuelDemoActive, fuelDisplayText]);
  const fuelWarningTitle = useMemo(() => {
    if (isFuelDemoActive && !baseFuelWarningActive) {
      return 'Low Fuel Warning (Demo)';
    }
    return 'Low Fuel Warning';
  }, [isFuelDemoActive, baseFuelWarningActive]);
  const warningBanners = useMemo<WarningBannerConfig[]>(() => {
    const banners: WarningBannerConfig[] = [];
    if (isSpeedWarningActive || isSpeedDemoActive) {
      banners.push({
        id: 'speed-warning',
        type: 'speed',
        icon: 'speedometer',
        title: isSpeedDemoActive ? 'Speed Warning (Demo)' : 'Speed Warning',
        message: `Current speed ${speedDisplayWithUnit}${
          speedWarningExcessValue !== null ? ` (+${speedWarningExcessValue} km/h)` : ''
        }. Slow down to ${speedLimitWithUnit} or below.`,
        note: isSpeedDemoActive
          ? 'Demo override active – showing example alert until GeoTab speed is available.'
          : undefined,
      });
    }
    if (isFuelWarningActive) {
      const displayFuelText = fuelDisplayTextForUi ?? 'unknown';
      const fuelMessage = `Fuel level ${displayFuelText} is below the recommended minimum (${fuelThresholdDescription}). Plan to refuel soon.`;
      banners.push({
        id: 'fuel-warning',
        type: 'fuel',
        icon: 'alert-circle',
        title: fuelWarningTitle,
        message: fuelMessage,
        note:
          fuelDisplayTextForUi === null
            ? `Thresholds: ${fuelThresholdDescription}.`
            : isFuelDemoActive && !baseFuelWarningActive
              ? 'Demo override active – showing example alert until fuel telemetry is available.'
              : undefined,
      });
    }
    return banners;
  }, [
    isSpeedWarningActive,
    isSpeedDemoActive,
    speedDisplayWithUnit,
    speedWarningExcessValue,
    speedLimitWithUnit,
    isFuelWarningActive,
    fuelThresholdDescription,
    fuelDisplayTextForUi,
    fuelWarningTitle,
    isFuelDemoActive,
    baseFuelWarningActive,
  ]);
  const vehicleInfoContentHtml = useMemo(() => {
    const name = vehicleLocation?.plateNumber || 'Live Location';
    const speedLine = effectiveSpeedKmh !== null
      ? `Speed: ${speedDisplayWithUnit}${isSpeedWarningActive ? ' (over limit)' : ''}${isSpeedDemoActive ? ' (demo)' : ''}`
      : 'Speed: N/A';
    const thresholdLine = `Warning threshold: ${speedLimitWithUnit}`;
    const excessLine = speedWarningExcessValue !== null ? `<br/>Over by ${speedWarningExcessValue} km/h` : '';
    const demoLine = isSpeedDemoActive ? '<br/><em>Demo warning override active</em>' : '';
    const fuelLine = fuelDisplayTextForUi ? `<br/>Fuel: ${fuelDisplayTextForUi}` : '';
    const fuelWarningLine = isFuelWarningActive
      ? `<br/><strong>Fuel alert:</strong> Below minimum (${fuelThresholdDescription}).`
      : '';
    return `<div><strong>Vehicle</strong><br/>${name}<br/>${speedLine}<br/>${thresholdLine}${excessLine}${demoLine}${fuelLine}${fuelWarningLine}</div>`;
  }, [
    vehicleLocation?.plateNumber,
    effectiveSpeedKmh,
    speedDisplayWithUnit,
    isSpeedWarningActive,
    speedLimitWithUnit,
    speedWarningExcessValue,
    isSpeedDemoActive,
    fuelDisplayTextForUi,
    isFuelWarningActive,
    fuelThresholdDescription,
  ]);

  const fetchGoogleMapsApiKey = useCallback(async (): Promise<string | null> => {
    if (googleMapsApiKeyRef.current !== undefined) {
      return googleMapsApiKeyRef.current ?? null;
    }

    // Use frontend Google Maps API key from config/env.ts
    const frontendApiKey = GOOGLE_MAPS_API_KEY;
    
    if (frontendApiKey && typeof frontendApiKey === 'string' && frontendApiKey.length > 0) {
      console.log('✅ Using frontend Google Maps API key');
      googleMapsApiKeyRef.current = frontendApiKey;
      return frontendApiKey;
    }

    console.warn('⚠️ Frontend Google Maps API key not found in config');
    googleMapsApiKeyRef.current = null;
    return null;
  }, []);

  const fetchRoutePolyline = useCallback(async () => {
    // For multiple dropoffs, we don't need dropoffLat/dropoffLng
    if (pickupLat === null || pickupLng === null) {
      setRoutePath([]);
      return;
    }

    // For single dropoff, we need dropoff coordinates
    if (!multipleDropOffs && (dropoffLat === null || dropoffLng === null)) {
      setRoutePath([]);
      return;
    }

    try {
      // Build ordered list of all coordinates for the route:
      // origin → intermediate stops → destination
      // OSRM expects coordinates as "lng,lat" (longitude first)
      const allCoords: string[] = [];
      allCoords.push(`${pickupLng},${pickupLat}`);

      if (multipleDropOffs && wayPoints.length > 0) {
        wayPoints.forEach((waypoint) => {
          // Skip the pickup waypoint — it's already the origin
          if (
            waypoint.pickup === true &&
            pickup &&
            parseCoordinate(waypoint.address?.latitude) === pickupLat &&
            parseCoordinate(waypoint.address?.longitude) === pickupLng
          ) {
            return;
          }

          let lat = parseCoordinate(waypoint.address?.latitude);
          let lng = parseCoordinate(waypoint.address?.longitude);

          if (lat === null || lng === null) {
            lat = parseCoordinate((waypoint as any)?.latitude);
            lng = parseCoordinate((waypoint as any)?.longitude);
          }

          if ((lat === null || lng === null) && (waypoint.address as any)?.coordinates) {
            const coords = (waypoint.address as any).coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
              lng = parseCoordinate(coords[0]);
              lat = parseCoordinate(coords[1]);
            }
          }

          if (lat !== null && lng !== null) {
            allCoords.push(`${lng},${lat}`);
          }
        });

        // If no waypoints resolved, add the dropoff as destination
        if (allCoords.length === 1) {
          if (dropoffLat !== null && dropoffLng !== null) {
            allCoords.push(`${dropoffLng},${dropoffLat}`);
          } else {
            allCoords.push(`${pickupLng},${pickupLat}`);
          }
        }
      } else {
        // Single dropoff
        allCoords.push(`${dropoffLng!},${dropoffLat!}`);
      }

      const osrmCoords = allCoords.join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=polyline`;

      console.log('🛣️ Fetching road route via OSRM...');
      console.log('📍 OSRM URL:', osrmUrl);

      const osrmResponse = await fetch(osrmUrl);
      if (!osrmResponse.ok) {
        throw new Error(`OSRM request failed: ${osrmResponse.status}`);
      }

      const osrmData = await osrmResponse.json();

      console.log('📦 OSRM response:', {
        code: osrmData.code,
        routesCount: osrmData.routes?.length,
        hasGeometry: !!osrmData.routes?.[0]?.geometry,
      });

      if (osrmData.code !== 'Ok' || !osrmData.routes?.length) {
        throw new Error(`OSRM returned no route: ${osrmData.code}`);
      }

      const polyline = osrmData.routes[0].geometry;
      if (polyline) {
        const decoded = decodePolyline(polyline);
        if (decoded.length > 1) {
          console.log(`✅ OSRM road route decoded: ${decoded.length} points`);
          setRoutePath(decoded);
          return;
        }
      }

      // Fallback to straight line if OSRM fails
      console.warn('⚠️ Falling back to straight line route');
      setRoutePath(routeCoordinates.slice());
    } catch (directionsError: any) {
      console.error('❌ Failed to load driving route:', directionsError);
      logger.warn('Failed to load driving route', directionsError);
      // Fallback to straight line
      setRoutePath(routeCoordinates.slice());
    }
  }, [
    multipleDropOffs,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    wayPoints,
    routeCoordinates,
    pickup,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    // For multiple dropoffs, we only need pickup and waypoints
    // For single dropoff, we need both pickup and dropoff
    if (pickupLat === null || pickupLng === null) {
      console.warn('⚠️ No pickup coordinates, using straight line');
      setRoutePath(routeCoordinates.slice());
      return;
    }

    if (!multipleDropOffs && (dropoffLat === null || dropoffLng === null)) {
      console.warn('⚠️ No dropoff coordinates, using straight line');
      setRoutePath(routeCoordinates.slice());
      return;
    }

    // Fetch actual route from Directions API
    console.log('🛣️ Fetching route with Directions API...');
    fetchRoutePolyline();
  }, [
    visible,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    multipleDropOffs,
    wayPoints,
    fetchRoutePolyline,
    routeCoordinates,
  ]);

  // Ensure native map view fits all key coordinates whenever they change
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (!visible) {
      return;
    }
    if (!mapRef.current) {
      return;
    }

    const points: Array<{ latitude: number; longitude: number }> = [];
    if (pickupLat !== null && pickupLng !== null) {
      points.push({ latitude: pickupLat, longitude: pickupLng });
    }
    
    // Add waypoints if multipleDropOffs is true
    if (multipleDropOffs && validWaypoints.length > 0) {
      validWaypoints.forEach((item) => {
        // Skip pickup waypoint if it's already added
        if (item.isPickup && pickup && 
            item.waypointLat === pickupLat && 
            item.waypointLng === pickupLng) {
          return;
        }
        points.push({ latitude: item.waypointLat, longitude: item.waypointLng });
      });
    } else if (dropoffLat !== null && dropoffLng !== null) {
      // Only add dropoff if not multiple dropoffs
      points.push({ latitude: dropoffLat, longitude: dropoffLng });
    }
    
    // Add yard location if vehicle location is not available (as starting point)
    if (!vehicleCoordinates && load.yardLocation?.coordinates) {
      const yardLat = parseCoordinate(load.yardLocation.coordinates.latitude);
      const yardLng = parseCoordinate(load.yardLocation.coordinates.longitude);
      if (yardLat !== null && yardLng !== null) {
        points.push({ latitude: yardLat, longitude: yardLng });
      }
    }
    
    if (vehicleCoordinates) {
      points.push(vehicleCoordinates);
    }
    if (routePath.length > 0) {
      // include start/end of route path for better padding
      points.push(routePath[0], routePath[routePath.length - 1]);
    }

    if (points.length === 0) {
      return;
    }

    try {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 80, bottom: 280, left: 80 },
        animated: true,
      });
    } catch (fitError) {
      logger.warn('Failed to fit map to coordinates', fitError);
    }
  }, [
    visible,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    vehicleCoordinates?.latitude,
    vehicleCoordinates?.longitude,
    routePath,
    multipleDropOffs,
    validWaypoints,
  ]);

  // Calculate distance metrics
  const distanceMetrics = useMemo(() => {
    let totalDistance = 0;
    let distanceTraveled = 0;
    let distanceRemaining = 0;

    // Calculate total route distance
    if (multipleDropOffs && validWaypoints.length > 0) {
      // Multiple drops: Calculate distance from pickup through all waypoints
      if (pickupLat !== null && pickupLng !== null && validWaypoints.length > 0) {
        // Distance from pickup to first waypoint
        const firstWaypoint = validWaypoints[0];
        totalDistance += calculateDistance(
          pickupLat,
          pickupLng,
          firstWaypoint.waypointLat,
          firstWaypoint.waypointLng
        );

        // Distance between waypoints
        for (let i = 0; i < validWaypoints.length - 1; i++) {
          totalDistance += calculateDistance(
            validWaypoints[i].waypointLat,
            validWaypoints[i].waypointLng,
            validWaypoints[i + 1].waypointLat,
            validWaypoints[i + 1].waypointLng
          );
        }
      }
    } else {
      // Single drop: Calculate distance from pickup to dropoff
      if (pickupLat !== null && pickupLng !== null && dropoffLat !== null && dropoffLng !== null) {
        totalDistance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      }
    }

    // Calculate distance traveled (from pickup to current vehicle position)
    if (vehicleCoordinates && pickupLat !== null && pickupLng !== null) {
      distanceTraveled = calculateDistance(
        pickupLat,
        pickupLng,
        vehicleCoordinates.latitude,
        vehicleCoordinates.longitude
      );
    }

    // Calculate distance remaining (from vehicle to next destination)
    if (vehicleCoordinates) {
      if (multipleDropOffs && validWaypoints.length > 0) {
        // For multiple drops, calculate distance from vehicle to nearest waypoint
        // and then add remaining waypoints distance
        let nearestWaypointIndex = 0;
        let nearestDistance = Infinity;
        
        // Find the nearest waypoint to the vehicle
        validWaypoints.forEach((waypoint, index) => {
          const dist = calculateDistance(
            vehicleCoordinates.latitude,
            vehicleCoordinates.longitude,
            waypoint.waypointLat,
            waypoint.waypointLng
          );
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestWaypointIndex = index;
          }
        });
        
        // Calculate distance from vehicle to nearest waypoint
        const nearestWaypoint = validWaypoints[nearestWaypointIndex];
        distanceRemaining = calculateDistance(
          vehicleCoordinates.latitude,
          vehicleCoordinates.longitude,
          nearestWaypoint.waypointLat,
          nearestWaypoint.waypointLng
        );
        
        // Add distance from nearest waypoint through remaining waypoints
        for (let i = nearestWaypointIndex; i < validWaypoints.length - 1; i++) {
          distanceRemaining += calculateDistance(
            validWaypoints[i].waypointLat,
            validWaypoints[i].waypointLng,
            validWaypoints[i + 1].waypointLat,
            validWaypoints[i + 1].waypointLng
          );
        }
      } else if (dropoffLat !== null && dropoffLng !== null) {
        // Single drop: Distance from vehicle to dropoff
        distanceRemaining = calculateDistance(
          vehicleCoordinates.latitude,
          vehicleCoordinates.longitude,
          dropoffLat,
          dropoffLng
        );
      }
    } else {
      // If no vehicle location, remaining = total
      distanceRemaining = totalDistance;
    }

    return {
      total: totalDistance,
      traveled: distanceTraveled,
      remaining: distanceRemaining,
    };
  }, [
    multipleDropOffs,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    validWaypoints,
    vehicleCoordinates,
  ]);
  const hasDistanceMetrics =
    distanceMetrics.total > 0 ||
    distanceMetrics.traveled > 0 ||
    distanceMetrics.remaining > 0;
  const shouldShowDistanceOverlay = hasDistanceMetrics;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        {!isFullScreen && (
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Route Map</Text>
              {load.internalId && (
                <Text style={styles.headerSubtitle}>Load: {load.internalId}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Map Container */}
        <View style={styles.mapContainer}>
          {ENABLE_SPEED_WARNING_DEMO && (
            <TouchableOpacity
              onPress={() => setForceWarningDemo((prev) => !prev)}
              style={[
                styles.demoToggleFloating,
                isSpeedDemoActive && styles.demoToggleFloatingActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSpeedDemoActive ? 'play-back' : 'flash'}
                size={18}
                color="#fff"
              />
              <Text style={styles.demoToggleFloatingText}>
                {isSpeedDemoActive ? 'Hide Demo' : 'Demo Speed Warning'}
              </Text>
            </TouchableOpacity>
          )}

          {warningBanners.length > 0 && (
            <View style={styles.warningStack}>
              {warningBanners.map((banner, index) => (
                <View
                  key={banner.id}
                  style={[
                    styles.warningBanner,
                    banner.type === 'speed'
                      ? styles.warningBannerSpeed
                      : styles.warningBannerFuel,
                    index > 0 && styles.warningBannerSpacing,
                  ]}
                >
                  <Ionicons
                    name={banner.icon}
                    size={22}
                    color="#fff"
                    style={styles.warningBannerIcon}
                  />
                  <View style={styles.warningBannerContent}>
                    <Text style={styles.warningBannerTitle}>{banner.title}</Text>
                    <Text style={styles.warningBannerMessage}>{banner.message}</Text>
                    {banner.note && (
                      <Text style={styles.warningBannerNote}>{banner.note}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Full Screen Toggle Button - iOS only */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[
                styles.fullScreenToggleButton,
                isFullScreen && styles.fullScreenToggleButtonActive,
                !shouldShowDistanceOverlay && styles.fullScreenToggleButtonAlone
              ]}
              onPress={handleFullScreenToggle}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isFullScreen ? "contract" : "expand"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          )}

          {/* Close Button in Fullscreen Mode - iOS only */}
          {Platform.OS === 'ios' && isFullScreen && (
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Distance Toggle Button */}
          {shouldShowDistanceOverlay && (
            <TouchableOpacity
              style={[
                styles.distanceToggleButton,
                isFullScreen && styles.distanceToggleButtonFullScreen
              ]}
              onPress={() => setShowDistanceInfo(!showDistanceInfo)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={showDistanceInfo ? "eye-off" : "eye"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          )}

          {/* Distance Info Overlay - Floating on Map */}
          {showDistanceInfo && shouldShowDistanceOverlay && (
            <View style={styles.mapDistanceOverlay}>
              <View style={styles.mapDistanceCard}>
                <View style={styles.mapDistanceHeader}>
                  <TouchableOpacity
                    onPress={() => setShowDistanceInfo(false)}
                    style={styles.mapDistanceCloseButton}
                  >
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.mapDistanceList}>
                  <View style={styles.mapDistanceListItem}>
                    <Ionicons name="map-outline" size={16} color="#6366F1" style={styles.mapDistanceListIcon} />
                    <View style={styles.mapDistanceItemContent}>
                      <Text style={styles.mapDistanceLabel}>Total Distance</Text>
                      <Text style={styles.mapDistanceValue}>
                        {distanceMetrics.total > 0 ? `${distanceMetrics.total.toFixed(1)} km` : 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapDistanceSeparator} />
                  <View style={styles.mapDistanceListItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.mapDistanceListIcon} />
                    <View style={styles.mapDistanceItemContent}>
                      <Text style={styles.mapDistanceLabel}>Distance Traveled</Text>
                      <Text style={styles.mapDistanceValue}>
                        {distanceMetrics.traveled > 0 ? `${distanceMetrics.traveled.toFixed(1)} km` : '0.0 km'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapDistanceSeparator} />
                  <View style={styles.mapDistanceListItem}>
                    <Ionicons name="navigate-circle" size={16} color="#F59E0B" style={styles.mapDistanceListIcon} />
                    <View style={styles.mapDistanceItemContent}>
                      <Text style={styles.mapDistanceLabel}>Distance Remaining</Text>
                      <Text style={styles.mapDistanceValue}>
                        {distanceMetrics.remaining > 0 ? `${distanceMetrics.remaining.toFixed(1)} km` : '0.0 km'}
                      </Text>
                    </View>
                  </View>
                  {fuelDisplayTextForUi && (
                    <>
                      <View style={styles.mapDistanceSeparator} />
                      <View style={styles.mapDistanceListItem}>
                        <Ionicons name="water" size={16} color="#0EA5E9" style={styles.mapDistanceListIcon} />
                        <View style={styles.mapDistanceItemContent}>
                          <Text style={styles.mapDistanceLabel}>Current Fuel Level</Text>
                          <Text style={[styles.mapDistanceValue, isFuelWarningActive ? styles.mapDistanceValueWarning : undefined]}>
                            {fuelDisplayTextForUi}
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
                {multipleDropOffs && validWaypoints.length > 0 && (
                  <View style={styles.mapDistanceWaypointContainer}>
                    <Text style={styles.mapDistanceWaypointInfo}>
                      {validWaypoints.length} stop{validWaypoints.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {mapLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
          
          {mapError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={styles.errorBannerText}>
                Map Error: {mapError}
              </Text>
              <TouchableOpacity 
                style={styles.errorButton} 
                onPress={() => {
                  console.log('🔄 Retrying map load...');
                  setMapError(null);
                  setMapLoading(true);
                  if (mapRef.current) {
                    const region = calculateRegion();
                    mapRef.current.animateToRegion(region, 500);
                  }
                }}
              >
                <Text style={styles.errorButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && !mapLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Connecting to live tracking...</Text>
            </View>
          )}

          {error && !loading && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={20} color="#FF6B6B" />
              <Text style={styles.errorBannerText}>
                Live tracking unavailable: {error.includes('\n') ? error.split('\n')[0] : error}
              </Text>
            </View>
          )}

          {Platform.OS === 'web' ? (
            <WebMapView
              pickup={pickup}
              dropoff={dropoff}
              vehicleLocation={vehicleLocation}
              routeCoordinates={routeCoordinates}
            routePath={routePath.length >= 2 ? routePath : routeCoordinates}
              vehicleCoordinates={vehicleCoordinates}
              speedDisplayWithUnit={speedDisplayWithUnit}
              speedWarningExcessValue={speedWarningExcessValue}
              speedLimitWithUnit={speedLimitWithUnit}
              isSpeedWarningActive={isSpeedWarningActive}
              isSpeedDemoActive={isSpeedDemoActive}
              fuelDisplayText={fuelDisplayTextForUi}
              isFuelWarningActive={isFuelWarningActive}
              vehicleInfoContentHtml={vehicleInfoContentHtml}
              warningBanners={warningBanners}
              enableSpeedWarningDemo={ENABLE_SPEED_WARNING_DEMO}
              onToggleSpeedDemo={() => setForceWarningDemo((prev) => !prev)}
              onOpenGoogleMaps={() => {
                // Open Google Maps with route if coordinates are available
                const coords = vehicleCoordinates || (pickupLat !== null && pickupLng !== null ? { latitude: pickupLat, longitude: pickupLng } : null);
                if (coords && coords.latitude !== null && coords.longitude !== null) {
                  const url = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
                  Linking.openURL(url);
                }
              }}
            />
          ) : MapView ? (() => {
            try {
              const region = calculateRegion();
              console.log('🗺️ Calculated region:', region);
              
              // Validate region coordinates
              if (!region || isNaN(region.latitude) || isNaN(region.longitude) || 
                  !isFinite(region.latitude) || !isFinite(region.longitude)) {
                console.error('❌ Invalid region:', region);
                throw new Error(`Invalid map region coordinates: ${JSON.stringify(region)}`);
              }
              
              // Validate delta values
              if (!region.latitudeDelta || !region.longitudeDelta || 
                  region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
                console.warn('⚠️ Invalid delta values, using defaults');
                region.latitudeDelta = region.latitudeDelta || 0.05;
                region.longitudeDelta = region.longitudeDelta || 0.05;
              }
              
              console.log('✅ Valid region, rendering map:', {
                lat: region.latitude,
                lng: region.longitude,
                latDelta: region.latitudeDelta,
                lngDelta: region.longitudeDelta
              });
              
              return (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  region={region}
                  initialRegion={region}
                  mapType="standard"
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={true}
                  showsScale={true}
                  toolbarEnabled={false}
                  loadingEnabled={true}
                  loadingIndicatorColor="#666666"
                  loadingBackgroundColor="#ffffff"
                  pitchEnabled={false}
                  rotateEnabled={true}
                  scrollEnabled={mapReady && mapLayoutReady}
                  zoomEnabled={mapReady && mapLayoutReady}
                  zoomControlEnabled={false}
                  minZoomLevel={5}
                  maxZoomLevel={20}
                  moveOnMount={false}
                  onLayout={() => {
                    console.log('✅ Map layout completed');
                    if (Platform.OS === 'ios') {
                      // On iOS, wait a bit longer for gesture recognizers to initialize
                      setTimeout(() => {
                        setMapLayoutReady(true);
                      }, 150);
                    } else {
                      setMapLayoutReady(true);
                    }
                  }}
                  onMapReady={() => {
                    console.log('✅ Map is ready and loaded');
                    console.log('📍 Map region:', region);
                    logger.info('Map ready', { region });
                    setMapReady(true);
                    setMapLoading(false);
                    setMapError(null);
                    // Ensure layout is marked as ready if onLayout hasn't fired yet (iOS fallback)
                    if (Platform.OS === 'ios' && !mapLayoutReady) {
                      setTimeout(() => {
                        setMapLayoutReady(true);
                      }, 200);
                    }
                  }}
                  onError={(error: any) => {
                    console.error('❌ Map error:', error);
                    console.error('❌ Error details:', JSON.stringify(error, null, 2));
                    logger.error('Map error', error);
                    const errorMessage = error?.message || error?.nativeEvent?.message || 'Map failed to load.';
                    setMapError(errorMessage);
                    setMapLoading(false);
                    // Show error but don't block the UI
                  }}
                  onLoadStart={() => {
                    console.log('🔄 Map loading started...');
                    console.log('📍 Initial region:', region);
                    setMapLoading(true);
                    setMapReady(false);
                    setMapLayoutReady(false);
                  }}
                  onLoadEnd={() => {
                    console.log('✅ Map load ended');
                  }}
                >
            {/* Pickup Marker with Label */}
            {pickupLat !== null && pickupLng !== null && (
              <Marker
                key={`pickup-${load._id}-${pickupLat.toFixed(4)}-${pickupLng.toFixed(4)}`}
                coordinate={{
                  latitude: pickupLat,
                  longitude: pickupLng,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={4000}
              >
                <View style={styles.markerWrapper} collapsable={false} pointerEvents="none">
                  {/* Round Marker - Circular */}
                  <View style={styles.roundMarkerContainer}>
                    <View style={[styles.roundMarker, styles.pickupRoundMarker]}>
                      <Ionicons name="location" size={24} color="#fff" />
                    </View>
                    <View style={[styles.roundMarkerShadow, styles.pickupRoundMarkerShadow]} />
                  </View>
                  
                  {/* Label Card */}
                  <View style={[
                    styles.markerCard, 
                    styles.pickupCard,
                    styles.markerCardAboveRound,
                    {
                      borderWidth: 3,
                      borderColor: '#1e40af',
                      shadowColor: '#3b82f6',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 1.0,
                      shadowRadius: 12,
                      elevation: 20,
                    }
                  ]}>
                    <Text style={[styles.markerCardTitle, { color: '#fff', fontWeight: '900', fontSize: 14 }]}>
                      📦 Pickup
                    </Text>
                    <Text style={[styles.markerCardSubtitle, { color: '#dbeafe', fontWeight: '600' }]} numberOfLines={1}>
                      {pickup?.place || pickup?.city || 'Location'}
                    </Text>
                  </View>
                </View>
              </Marker>
            )}

            {/* Dropoff Marker with Label */}
            {!multipleDropOffs && dropoffLat !== null && dropoffLng !== null && (
              <Marker
                key={`dropoff-${load._id}-${dropoffLat.toFixed(4)}-${dropoffLng.toFixed(4)}`}
                coordinate={{
                  latitude: dropoffLat,
                  longitude: dropoffLng,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={3500}
              >
                <View style={styles.markerWrapper} collapsable={false} pointerEvents="none">
                  {/* Round Marker - Circular */}
                  <View style={styles.roundMarkerContainer}>
                    <View style={[styles.roundMarker, styles.dropoffRoundMarker]}>
                      <Ionicons name="location" size={24} color="#fff" />
                    </View>
                    <View style={[styles.roundMarkerShadow, styles.dropoffRoundMarkerShadow]} />
                  </View>
                  
                  {/* Label Card */}
                  <View style={[
                    styles.markerCard, 
                    styles.dropoffCard,
                    styles.markerCardAboveRound,
                    {
                      borderWidth: 3,
                      borderColor: '#d97706',
                      shadowColor: '#f59e0b',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 1.0,
                      shadowRadius: 12,
                      elevation: 20,
                    }
                  ]}>
                    <Text style={[styles.markerCardTitle, { color: '#fff', fontWeight: '900', fontSize: 14 }]}>
                      🚚 Drop-off
                    </Text>
                    <Text style={[styles.markerCardSubtitle, { color: '#fef3c7', fontWeight: '600' }]} numberOfLines={1}>
                      {dropoff?.place || dropoff?.city || 'Location'}
                    </Text>
                  </View>
                </View>
              </Marker>
            )}

            {/* Waypoint Markers with Labels - Shows all stops including additional stops */}
            {validWaypoints.length > 0 && validWaypoints.map((item, displayIndex) => {
              const { waypoint, waypointLat, waypointLng, originalIndex, isDropoff, isPickup, stopNumber, stopType } = item;
              
              // Log each waypoint being rendered
              console.log(`🗺️ Rendering waypoint ${displayIndex + 1}:`, {
                place: waypoint.address?.place,
                stopNumber,
                stopType,
                isPickup,
                isDropoff,
                coords: [waypointLat, waypointLng]
              });
              
              // Skip rendering pickup waypoint if it's already shown as pickup marker
              // Only skip if pickup exists and coordinates match
              if (isPickup && pickup && 
                  parseCoordinate(pickup?.latitude) === waypointLat &&
                  parseCoordinate(pickup?.longitude) === waypointLng) {
                console.log(`  ⏭️ Skipping waypoint (already shown as pickup marker)`);
                return null;
              }
              
              // Create unique key for each marker
              const markerKey = `waypoint-${load._id}-${originalIndex}-${Math.round(waypointLat * 10000)}-${Math.round(waypointLng * 10000)}`;

              // Log if this is an additional stop
              if (stopType === 'additional') {
                console.log(`  ⭐ This is an ADDITIONAL STOP - should be highlighted!`, {
                  stopNumber,
                  stopType,
                  hasHighlight: true
                });
              }

              // Determine pin color based on stop type
              let pinColor = '#3b82f6'; // Default blue for pickup
              if (stopType === 'additional') {
                pinColor = '#fbbf24'; // Yellow for additional stops
              } else if (isDropoff) {
                pinColor = '#f59e0b'; // Orange for drop-off
              } else if (isPickup) {
                pinColor = '#3b82f6'; // Blue for pickup
              }

              console.log(`🎨 Rendering marker for waypoint ${displayIndex + 1}:`, {
                place: waypoint.address?.place,
                stopNumber,
                stopType,
                pinColor,
                isPickup,
                isDropoff,
                coords: [waypointLat, waypointLng]
              });

              // Force re-render for additional stops to ensure highlighting is visible
              const isAdditionalStop = stopType === 'additional';
              
              console.log(`🎨 Rendering marker for waypoint ${displayIndex + 1}:`, {
                place: waypoint.address?.place,
                stopNumber,
                stopType,
                isAdditionalStop,
                isPickup,
                isDropoff,
                coords: [waypointLat, waypointLng],
                willHighlight: isAdditionalStop,
                zIndex: isAdditionalStop ? 3000 + originalIndex : 1000 + originalIndex
              });
              
              return (
                <Marker
                  key={markerKey}
                  coordinate={{
                    latitude: waypointLat,
                    longitude: waypointLng,
                  }}
                  anchor={{ x: 0.5, y: 1.0 }}
                  tracksViewChanges={isAdditionalStop}
                  zIndex={isAdditionalStop ? 3000 + originalIndex : 1000 + originalIndex}
                >
                  <View style={styles.markerWrapper} collapsable={false} pointerEvents="none">
                    <View
                      style={[
                        styles.markerCard,
                        // For additional stops, use special highlighting - MUST be first to ensure it applies
                        isAdditionalStop && styles.additionalStopCard,
                        !isAdditionalStop && isDropoff && styles.dropoffCard,
                        !isAdditionalStop && isPickup && styles.pickupCard,
                        !isAdditionalStop && !isPickup && !isDropoff && styles.waypointCard,
                        // Additional inline styles for extra emphasis on additional stops
                        isAdditionalStop && {
                          borderWidth: 6,
                          borderColor: '#f59e0b',
                          shadowColor: '#f59e0b',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 1.0,
                          shadowRadius: 15,
                          elevation: 25,
                        },
                      ]}
                    >
                      <Text style={[
                        styles.markerCardTitle,
                        isAdditionalStop && { 
                          color: '#78350f',
                          fontWeight: '900',
                          fontSize: 14,
                        }
                      ]}>
                        {stopNumber 
                          ? `${isDropoff ? 'Drop-off' : 'Pickup'} Stop ${stopNumber}`
                          : isDropoff 
                          ? 'Drop-off' 
                          : isPickup 
                          ? 'Pickup' 
                          : `Stop ${displayIndex + 1}`}
                        {isAdditionalStop && ' ⭐'}
                      </Text>
                      <Text style={[
                        styles.markerCardSubtitle,
                        isAdditionalStop && { 
                          color: '#92400e',
                          fontWeight: '700',
                        }
                      ]} numberOfLines={1}>
                        {waypoint.address?.place || waypoint.address?.city || 'Waypoint'}
                      </Text>
                      {isAdditionalStop && (
                        <View style={[styles.markerCardBadge, { backgroundColor: '#f59e0b' }]}>
                          <Text style={[styles.markerCardBadgeText, { color: '#fff', fontWeight: '900' }]}>
                            Additional Stop
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* Enhanced marker pointer for additional stops */}
                    <View
                      style={[
                        styles.markerPointer,
                        isAdditionalStop
                          ? styles.additionalStopPointer
                          : isDropoff
                          ? styles.dropoffPointer
                          : isPickup
                          ? styles.pickupPointer
                          : styles.waypointPointer,
                        isAdditionalStop && {
                          width: 32,
                          height: 32,
                          backgroundColor: '#f59e0b',
                          borderWidth: 5,
                          borderColor: '#fff',
                          borderRadius: 16,
                          transform: [{ rotate: '0deg' }],
                          shadowColor: '#f59e0b',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 1.0,
                          shadowRadius: 15,
                          elevation: 30,
                          marginTop: -12,
                        }
                      ]}
                    >
                      {isAdditionalStop && (
                        <Ionicons name="location" size={18} color="#fff" />
                      )}
                    </View>
                    <View
                      style={[
                        styles.markerPointerShadow,
                        isAdditionalStop
                          ? styles.additionalStopPointerShadow
                          : isDropoff
                          ? styles.dropoffPointerShadow
                          : isPickup
                          ? styles.pickupPointerShadow
                          : styles.waypointPointerShadow,
                        isAdditionalStop && {
                          width: 42,
                          height: 14,
                          backgroundColor: 'rgba(245, 158, 11, 0.8)',
                          borderRadius: 7,
                          marginTop: 2,
                        }
                      ]}
                    />
                  </View>
                </Marker>
              );
            })}

            {/* Yard Location Marker (Starting Point) - Show when vehicle location is not available */}
            {!vehicleCoordinates && load.yardLocation?.coordinates && (() => {
              const yardLat = parseCoordinate(load.yardLocation.coordinates.latitude);
              const yardLng = parseCoordinate(load.yardLocation.coordinates.longitude);
              if (yardLat !== null && yardLng !== null) {
                return (
                  <Marker
                    key={`yard-${load._id}-${yardLat}-${yardLng}`}
                    coordinate={{ latitude: yardLat, longitude: yardLng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={2500}
                    pinColor="#10b981"
                  >
                    <View style={styles.markerWrapper} collapsable={false} pointerEvents="none">
                      <View style={[styles.markerCard, styles.yardCard]}>
                        <Text style={styles.markerCardTitle}>
                          🏭 {load.yardLocation.yardName || 'Yard'}
                        </Text>
                        <Text style={styles.markerCardSubtitle} numberOfLines={1}>
                          Starting Point
                        </Text>
                      </View>
                      <View style={styles.yardPointer} />
                      <View style={styles.yardPointerShadow} />
                    </View>
                  </Marker>
                );
              }
              return null;
            })()}

            {/* Route from Yard to Vehicle Location */}
            {vehicleCoordinates && load.yardLocation?.coordinates && (() => {
              const yardLat = parseCoordinate(load.yardLocation.coordinates.latitude);
              const yardLng = parseCoordinate(load.yardLocation.coordinates.longitude);
              if (yardLat !== null && yardLng !== null) {
                const yardToVehicleRoute = [
                  { latitude: yardLat, longitude: yardLng },
                  { latitude: vehicleCoordinates.latitude, longitude: vehicleCoordinates.longitude }
                ];
                return (
                  <Polyline
                    key={`yard-to-vehicle-${load._id}`}
                    coordinates={yardToVehicleRoute}
                    strokeColor="#10b981"
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                    lineDashPattern={[8, 4]}
                    zIndex={2000}
                  />
                );
              }
              return null;
            })()}

            {/* Vehicle Location with Label */}
            {vehicleCoordinates && vehicleCoordinates.latitude !== null && vehicleCoordinates.longitude !== null && (
              <Marker
                key={`vehicle-${load._id}-${vehicleLocation?._id || 'unknown'}-${Math.round(vehicleCoordinates.latitude * 10000)}-${Math.round(vehicleCoordinates.longitude * 10000)}`}
                coordinate={vehicleCoordinates}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={3000}
                pinColor="#1d4ed8"
              />
            )}

            {Polyline && routePath.length >= 2 && (
              <Polyline
                coordinates={routePath}
                strokeColor="#3b82f6"
                strokeWidth={6}
          
                lineCap="round"
                lineJoin="round"
                miterLimit={1}
                zIndex={100}
              />
            )}
            
            {/* Fallback: Show straight line if route path is not available */}
            {Polyline && routePath.length < 2 && routeCoordinates.length >= 2 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#9ca3af"
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            )}

                </MapView>
              );
            } catch (mapError: any) {
              logger.error('Error rendering map', mapError);
              return (
                <View style={styles.mapFallback}>
                  <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
                  <Text style={styles.fallbackText}>Map Error</Text>
                  <Text style={styles.fallbackSubtext}>
                    {mapError?.message || 'Failed to render map. Please try again.'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.errorButton} 
                    onPress={() => {
                      const pickupLat = parseCoordinate(pickup?.latitude);
                      const pickupLng = parseCoordinate(pickup?.longitude);
                      if (pickupLat !== null && pickupLng !== null) {
                        const url = `https://www.google.com/maps?q=${pickupLat},${pickupLng}`;
                        Linking.openURL(url);
                      }
                    }}
                  >
                    <Text style={styles.errorButtonText}>Open in Google Maps</Text>
                  </TouchableOpacity>
                </View>
              );
            }
          })() : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={64} color="#8B5CF6" />
              <Text style={styles.fallbackText}>Maps Not Available</Text>
              <Text style={styles.fallbackSubtext}>
                {!MapView ? 'react-native-maps is not installed. Please rebuild the app with EAS Build.' : 'Map is not available. Please check your configuration.'}
              </Text>
              <TouchableOpacity 
                style={styles.errorButton} 
                onPress={() => {
                  if (pickupLat !== null && pickupLng !== null) {
                    const url = `https://www.google.com/maps?q=${pickupLat},${pickupLng}`;
                    Linking.openURL(url);
                  }
                }}
              >
                <Text style={styles.errorButtonText}>Open in Google Maps</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info Panel */}
        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <View style={[styles.legendItem, styles.pickupLegend]} />
            <Text style={styles.legendText}>Pickup</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.legendItem, styles.dropoffLegend]} />
            <Text style={styles.legendText}>
              {multipleDropOffs ? 'Drop-offs' : 'Drop-off'}
            </Text>
          </View>
          {multipleDropOffs && wayPoints.length > 0 && (
            <View style={styles.infoRow}>
              <View style={[styles.legendItem, styles.waypointLegend]} />
              <Text style={styles.legendText}>
                Waypoints ({wayPoints.filter(wp => wp.dropOff !== true && wp.pickup !== true).length})
              </Text>
            </View>
          )}
          {vehicleLocation && (
            <>
              <View style={styles.infoRow}>
                <View style={[styles.legendItem, styles.vehicleLegend]} />
                <Text style={styles.legendText}>Vehicle (Live)</Text>
              </View>
              {(vehicleLocation.speed !== undefined && vehicleLocation.speed !== null) || isSpeedDemoActive ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.speedText, isSpeedWarningActive ? styles.speedTextWarning : undefined]}>
                      Speed: {speedDisplayWithUnit}
                      {isSpeedDemoActive ? ' (demo)' : ''}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.speedLimitText}>
                      Warning threshold {speedLimitWithUnit}
                    </Text>
                  </View>
                </>
              ) : null}
              {fuelDisplayTextForUi && (
                <View style={styles.infoRow}>
                  <Text style={[styles.fuelText, isFuelWarningActive ? styles.fuelTextWarning : undefined]}>
                    Fuel: {fuelDisplayTextForUi}
                  </Text>
                </View>
              )}
              {vehicleLocation.currentLocation?.address && (
                <Text style={styles.addressText} numberOfLines={1}>
                  {vehicleLocation.currentLocation.address}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({

  // ── Screen / container ──────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.bgCard,
    paddingTop: 20,
    paddingBottom: SPACING.base,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,209,255,0.10)',
  },

  // ── Map container ────────────────────────────────────────────────────────────
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },

  // ── Warning banners ──────────────────────────────────────────────────────────
  warningStack: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 1100,
  },
  warningStackWeb: {
    bottom: 140,
    left: 20,
    right: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
  warningBannerSpeed: {
    backgroundColor: 'rgba(220,38,38,0.95)',
  },
  warningBannerFuel: {
    backgroundColor: 'rgba(234,179,8,0.95)',
  },
  warningBannerSpacing: {
    marginTop: SPACING.md,
  },
  warningBannerIcon: {
    marginRight: SPACING.md,
    marginTop: 2,
  },
  warningBannerContent: {
    flex: 1,
  },
  warningBannerTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  warningBannerMessage: {
    fontSize: FONT_SIZE.sm,
    color: '#F9FAFB',
    lineHeight: 18,
  },
  warningBannerNote: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.xs,
    color: '#FDE68A',
    lineHeight: 16,
  },

  // ── Floating map overlay buttons ─────────────────────────────────────────────
  distanceToggleButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1001,
    elevation: 11,
    backgroundColor: COLORS.accentBlue,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
  },
  distanceToggleButtonFullScreen: {
    top: 16,
  },
  fullScreenToggleButton: {
    position: 'absolute',
    top: 16,
    right: 68,
    zIndex: 1001,
    elevation: 11,
    backgroundColor: COLORS.bgCard,
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fullScreenToggleButtonAlone: {
    right: 16,
  },
  fullScreenToggleButtonActive: {
    backgroundColor: COLORS.accentBlue,
    borderColor: COLORS.accentBlue,
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 1002,
    elevation: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Distance overlay card ────────────────────────────────────────────────────
  mapDistanceOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 72,
    zIndex: 1000,
    elevation: 10,
  },
  mapDistanceCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    minWidth: 120,
    maxWidth: 160,
  },
  mapDistanceHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mapDistanceCloseButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  mapDistanceList: {
    marginTop: 2,
  },
  mapDistanceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  mapDistanceListIcon: {
    marginRight: SPACING.sm,
    width: 16,
    textAlign: 'center',
  },
  mapDistanceItemContent: {
    flex: 1,
  },
  mapDistanceSeparator: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 3,
  },
  mapDistanceLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  mapDistanceValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  mapDistanceValueWarning: {
    color: COLORS.accentRed,
  },
  mapDistanceWaypointContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  mapDistanceWaypointInfo: {
    fontSize: 11,
    color: COLORS.accentBlue,
    textAlign: 'center',
    fontWeight: FONT_WEIGHT.semibold,
  },

  // ── Demo toggle ──────────────────────────────────────────────────────────────
  demoToggleFloating: {
    position: 'absolute',
    top: 80,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(99,102,241,0.92)',
    zIndex: 1100,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  demoToggleFloatingActive: {
    backgroundColor: 'rgba(234,88,12,0.92)',
  },
  demoToggleFloatingText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    marginLeft: SPACING.sm,
  },
  demoToggleFloatingWeb: {
    top: 100,
    right: 20,
  },

  // ── Loading / error overlays ─────────────────────────────────────────────────
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,18,32,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,18,32,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: SPACING.base,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.accentRed,
    textAlign: 'center',
    fontWeight: FONT_WEIGHT.semibold,
  },
  errorHelpText: {
    marginTop: SPACING.base,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.base,
    lineHeight: 20,
  },
  errorBanner: {
    position: 'absolute',
    top: 10, left: 10, right: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: COLORS.accentOrange,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.accentOrange,
    marginLeft: SPACING.sm,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Map markers ──────────────────────────────────────────────────────────────
  // Pickup — green
  pickupMarkerContainer: {
    width: 50, height: 50,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  pickupMarker: {
    width: 44, height: 60,
    borderRadius: 22,
    backgroundColor: '#27ae60',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#fff',
    elevation: 7,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6,
    zIndex: 2,
  },
  pickupMarkerPulse: {
    position: 'absolute',
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#27ae60', opacity: 0.3, zIndex: 1,
  },
  // Dropoff — red diamond
  dropoffMarkerContainer: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  dropoffMarker: {
    width: 44, height: 44,
    backgroundColor: '#e74c3c',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#fff',
    elevation: 7,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  dropoffMarkerIcon: {
    transform: [{ rotate: '-45deg' }],
  },
  // Vehicle
  simpleMarker: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },
  // Waypoint
  waypointMarkerContainer: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  waypointMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f39c12',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
    elevation: 6,
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4,
  },
  waypointNumber: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  markerWrapper: {
    alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 4,
  },
  // Round markers
  roundMarkerContainer: {
    position: 'relative', zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  roundMarker: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#3b82f6',
    borderWidth: 5, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 20,
  },
  pickupRoundMarker:  { backgroundColor: '#3b82f6', borderColor: '#fff' },
  dropoffRoundMarker: { backgroundColor: '#f59e0b', borderColor: '#fff' },
  roundMarkerShadow: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    top: 3, left: 0, zIndex: -1,
  },
  pickupRoundMarkerShadow:  { backgroundColor: 'rgba(59,130,246,0.4)' },
  dropoffRoundMarkerShadow: { backgroundColor: 'rgba(245,158,11,0.4)' },

  // ── Marker label cards ───────────────────────────────────────────────────────
  markerCardAboveRound: { marginBottom: 60 },
  markerCard: {
    minWidth: 150, maxWidth: 220,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  pickupCard:        { backgroundColor: '#3b82f6' },
  dropoffCard:       { backgroundColor: '#f59e0b' },
  waypointCard:      { backgroundColor: '#c2410c' },
  additionalStopCard: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 2, borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 10,
  },
  yardCard: { backgroundColor: '#10b981' },
  markerCardTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  markerCardSubtitle: {
    color: '#e5e7eb',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
  },
  markerCardBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: '#f59e0b',
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderWidth: 2, borderColor: '#fff',
  },
  markerCardBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markerCardMeta: {
    marginTop: SPACING.sm,
    color: '#bfdbfe',
    fontSize: 11,
    fontWeight: FONT_WEIGHT.semibold,
  },
  markerPointer: {
    width: 12, height: 12,
    transform: [{ rotate: '45deg' }],
    marginTop: -8, borderRadius: 3,
    backgroundColor: COLORS.bgCard,
  },
  markerPointerShadow: {
    width: 22, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 4,
  },
  pickupPointer:          { backgroundColor: '#3b82f6' },
  dropoffPointer:         { backgroundColor: '#f59e0b' },
  waypointPointer:        { backgroundColor: '#c2410c' },
  additionalStopPointer:  { backgroundColor: '#fbbf24' },
  yardPointer:            { backgroundColor: '#10b981' },
  pickupPointerShadow:         { backgroundColor: 'rgba(59,130,246,0.25)' },
  dropoffPointerShadow:        { backgroundColor: 'rgba(245,158,11,0.25)' },
  waypointPointerShadow:       { backgroundColor: 'rgba(194,65,12,0.25)' },
  additionalStopPointerShadow: { backgroundColor: 'rgba(251,191,36,0.4)' },
  yardPointerShadow:           { backgroundColor: 'rgba(16,185,129,0.25)' },

  // ── Callouts ─────────────────────────────────────────────────────────────────
  waypointLegend:       { backgroundColor: '#f39c12' },
  waypointCalloutHeader:{ backgroundColor: '#f39c12' },
  calloutContainer: {
    width: 200, padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  calloutHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm, marginBottom: SPACING.sm,
  },
  pickupCalloutHeader:  { backgroundColor: '#3b82f6' },
  dropoffCalloutHeader: { backgroundColor: '#f59e0b' },
  vehicleCalloutHeader: { backgroundColor: COLORS.accentBlue },
  calloutTitle: {
    fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white, marginLeft: SPACING.sm,
  },
  calloutText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  calloutAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },

  // ── Bottom info panel ─────────────────────────────────────────────────────────
  infoPanel: {
    backgroundColor: COLORS.bgCard,
    padding: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    marginRight: SPACING.base, marginBottom: SPACING.sm,
  },
  legendItem: {
    width: 16, height: 16, borderRadius: 8, marginRight: SPACING.sm,
  },
  pickupLegend:  { backgroundColor: '#27ae60' },
  dropoffLegend: { backgroundColor: '#e74c3c' },
  vehicleLegend: { backgroundColor: COLORS.accentBlue },
  legendText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  speedText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginLeft: SPACING.sm,
  },
  speedTextWarning: { color: COLORS.accentOrange },
  speedLimitText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  fuelText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentGreen,
    marginLeft: SPACING.sm,
  },
  fuelTextWarning: { color: COLORS.accentRed },
  addressText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    flex: 1,
  },

  // ── Map fallback (web / no-maps) ──────────────────────────────────────────────
  mapFallback: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.bgMain,
    padding: SPACING['2xl'],
  },
  fallbackText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.base,
  },
  fallbackSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  webInfoContainer: {
    marginTop: SPACING.xl,
    padding: SPACING.base,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    width: '100%', maxWidth: 400,
  },
  webInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  webInfoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  webInfoValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  webInfoValueWarning: {
    color: COLORS.accentRed,
    fontWeight: FONT_WEIGHT.bold,
  },
  webInfoAlert: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  webInfoAlertIcon: { marginRight: SPACING.sm },
  webInfoAlertText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  webInfoDemoNote: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.xs,
    color: COLORS.accentOrange,
    fontWeight: FONT_WEIGHT.medium,
  },
  openMapsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accentBlue,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  openMapsButtonText: {
    color: COLORS.black,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
  },
  routeInfoContainer: {
    marginTop: SPACING.base,
    padding: SPACING.base,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    width: '100%', maxWidth: 400,
  },
  routeInfoItem: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md,
  },
  routeDotWeb: {
    width: 12, height: 12, borderRadius: 6, marginRight: SPACING.md,
  },
  routeInfoText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1,
  },
  errorButton: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md, marginTop: SPACING.base,
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  errorButtonText: {
    color: COLORS.black,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

// Web-compatible map view component
interface WebMapViewProps {
  pickup?: any;
  dropoff?: any;
  vehicleLocation?: VehicleLocation | null;
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  routePath: Array<{ latitude: number; longitude: number }>;
  vehicleCoordinates: { latitude: number; longitude: number } | null;
  speedDisplayWithUnit: string;
  speedWarningExcessValue: number | null;
  speedLimitWithUnit: string;
  isSpeedWarningActive: boolean;
  isSpeedDemoActive: boolean;
  fuelDisplayText: string | null;
  isFuelWarningActive: boolean;
  vehicleInfoContentHtml: string;
  warningBanners: WarningBannerConfig[];
  enableSpeedWarningDemo: boolean;
  onToggleSpeedDemo: () => void;
  onOpenGoogleMaps: () => void;
}

const WebMapView: React.FC<WebMapViewProps> = ({
  pickup,
  dropoff,
  vehicleLocation,
  routeCoordinates,
  routePath,
  vehicleCoordinates,
  speedDisplayWithUnit,
  speedWarningExcessValue,
  speedLimitWithUnit,
  isSpeedWarningActive,
  isSpeedDemoActive,
  fuelDisplayText,
  isFuelWarningActive,
  vehicleInfoContentHtml,
  warningBanners,
  enableSpeedWarningDemo,
  onToggleSpeedDemo,
  onOpenGoogleMaps,
}) => {
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const googleMapRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const vehicleMarkerRef = React.useRef<any>(null);
  const vehicleInfoWindowRef = React.useRef<any>(null);
  const routePolylineRef = React.useRef<any>(null);

  // Helper function to get config using apiService to ensure correct base URL
  const getConfig = React.useCallback(async () => {
    // Use frontend Google Maps API key from config/env.ts
    const frontendApiKey = GOOGLE_MAPS_API_KEY;
    
    if (frontendApiKey && typeof frontendApiKey === 'string' && frontendApiKey.length > 0) {
      console.log('✅ Using frontend Google Maps API key');
      return { googleMapsApiKey: frontendApiKey };
    }
    
    console.warn('⚠️ Frontend Google Maps API key not found in config');
    return { googleMapsApiKey: '' };
  }, []);

  // Fetch Google Maps API key and load script
  React.useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Check if Google Maps is already loaded
        if ((window as any).google?.maps) {
          setMapLoaded(true);
          return;
        }

        // Use frontend Google Maps API key from config/env.ts
        const apiKey = GOOGLE_MAPS_API_KEY;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
          console.error('❌ Frontend Google Maps API key not found.');
          console.error('   Please ensure:');
          console.error('   1. GOOGLE_MAPS_API_KEY is set in .env file');
          console.error('   2. Or googleMapsApiKey is set in app.json extra config');
          console.error('   The map will still display route information without Google Maps.');
          
          // If no API key, set map as "loaded" but it will show a fallback message
          setMapLoaded(true);
          return;
        }
        
        console.log('✅ Using frontend Google Maps API key');

        console.log('✅ Google Maps API key ready, loading map script...');

        // Load Google Maps script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions&callback=initMap`;
        script.async = true;
        script.defer = true;

        // Set up callback
        (window as any).initMap = () => {
          console.log('✅ Google Maps script loaded and initialized');
          setMapLoaded(true);
        };

        // Handle script load errors
        script.onerror = (error) => {
          console.error('❌ Failed to load Google Maps script:', error);
          setMapLoaded(true); // Still mark as loaded to show fallback
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('❌ Error loading Google Maps:', error);
        setMapLoaded(true); // Mark as loaded to show fallback UI
      }
    };

    // Only load on web platform
    if (typeof window !== 'undefined') {
      loadGoogleMaps();
    }
  }, []); // Removed getConfig dependency since we're using frontend key

  // Initialize map when loaded
  React.useEffect(() => {
    if (!mapLoaded || !mapRef.current || !(window as any).google?.maps) return;

    const pickupLatNum = parseCoordinate(pickup?.latitude);
    const pickupLngNum = parseCoordinate(pickup?.longitude);
    const center = pickupLatNum !== null && pickupLngNum !== null
      ? { lat: pickupLatNum, lng: pickupLngNum }
      : { lat: 43.6532, lng: -79.3832 }; // Default to Toronto

    // Create map
    googleMapRef.current = new (window as any).google.maps.Map(mapRef.current, {
      zoom: 10,
      center: center,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add pickup marker (reuse already parsed coordinates)
    if (pickupLatNum !== null && pickupLngNum !== null) {
      const pickupMarker = new (window as any).google.maps.Marker({
        position: { lat: pickupLatNum, lng: pickupLngNum },
        map: googleMapRef.current,
        title: 'Pickup Location',
        label: {
          text: 'P',
          color: '#fff',
          fontWeight: 'bold',
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#27ae60',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(pickupMarker);

      // Add info window
      const pickupInfo = new (window as any).google.maps.InfoWindow({
        content: `<div><strong>Pickup</strong><br/>${pickup.place || `${pickup.city}, ${pickup.state}`}</div>`,
      });
      pickupMarker.addListener('click', () => pickupInfo.open(googleMapRef.current, pickupMarker));
    }

    // Add dropoff marker
    const dropoffLatNum = parseCoordinate(dropoff?.latitude);
    const dropoffLngNum = parseCoordinate(dropoff?.longitude);
    if (dropoffLatNum !== null && dropoffLngNum !== null) {
      const dropoffMarker = new (window as any).google.maps.Marker({
        position: { lat: dropoffLatNum, lng: dropoffLngNum },
        map: googleMapRef.current,
        title: 'Drop-off Location',
        label: {
          text: 'D',
          color: '#fff',
          fontWeight: 'bold',
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#e74c3c',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(dropoffMarker);

      const dropoffInfo = new (window as any).google.maps.InfoWindow({
        content: `<div><strong>Drop-off</strong><br/>${dropoff.place || `${dropoff.city}, ${dropoff.state}`}</div>`,
      });
      dropoffMarker.addListener('click', () => dropoffInfo.open(googleMapRef.current, dropoffMarker));
    }

    // Add vehicle marker if available (will be updated in separate useEffect)
    if (vehicleCoordinates?.latitude && vehicleCoordinates?.longitude) {
      // Remove old vehicle marker if it exists
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setMap(null);
        vehicleMarkerRef.current = null;
      }

      vehicleMarkerRef.current = new (window as any).google.maps.Marker({
        position: { lat: vehicleCoordinates.latitude, lng: vehicleCoordinates.longitude },
        map: googleMapRef.current,
        title: 'Vehicle Location',
        label: {
          text: 'V',
          color: '#fff',
          fontWeight: 'bold',
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3498db',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        animation: (window as any).google.maps.Animation.DROP,
      });
      markersRef.current.push(vehicleMarkerRef.current);

      vehicleInfoWindowRef.current = new (window as any).google.maps.InfoWindow({
        content: vehicleInfoContentHtml,
      });
      vehicleMarkerRef.current.addListener('click', () => {
        vehicleInfoWindowRef.current.open(googleMapRef.current, vehicleMarkerRef.current);
      });
    }

    // Draw route if we have both pickup and dropoff
    const pickupLatForRoute = parseCoordinate(pickup?.latitude);
    const pickupLngForRoute = parseCoordinate(pickup?.longitude);
    const dropoffLatForRoute = parseCoordinate(dropoff?.latitude);
    const dropoffLngForRoute = parseCoordinate(dropoff?.longitude);
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    const polylineSource = (routePath && routePath.length >= 2 ? routePath : routeCoordinates)
      .map(point => ({ lat: point.latitude, lng: point.longitude }));
    if (polylineSource.length >= 2 && googleMapRef.current) {
      routePolylineRef.current = new (window as any).google.maps.Polyline({
        path: polylineSource,
        geodesic: true,
        strokeColor: '#8B5CF6',
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      routePolylineRef.current.setMap(googleMapRef.current);
    }

    // Fit bounds to show all markers
    if (googleMapRef.current) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        const pos = marker.getPosition();
        if (pos) bounds.extend(pos);
      });
      const polylineSource = (routePath && routePath.length >= 2 ? routePath : routeCoordinates);
      polylineSource.forEach(point => {
        bounds.extend({ lat: point.latitude, lng: point.longitude });
      });
      if (!bounds.isEmpty()) {
        googleMapRef.current.fitBounds(bounds);
      }
    }
  }, [mapLoaded, pickup, dropoff, routeCoordinates, routePath]);

  // Update vehicle marker position in real-time when location changes
  React.useEffect(() => {
    if (!mapLoaded || !googleMapRef.current || !(window as any).google?.maps) return;
    if (!vehicleCoordinates?.latitude || !vehicleCoordinates?.longitude) return;

    const vehicleLat = vehicleCoordinates.latitude;
    const vehicleLng = vehicleCoordinates.longitude;

    // Update existing vehicle marker position
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setPosition({ lat: vehicleLat, lng: vehicleLng });
      
      // Update info window content with latest vehicle data
      if (vehicleInfoWindowRef.current && vehicleLocation) {
        vehicleInfoWindowRef.current.setContent(vehicleInfoContentHtml);
      }
    } else {
      // Create vehicle marker if it doesn't exist
      vehicleMarkerRef.current = new (window as any).google.maps.Marker({
        position: { lat: vehicleLat, lng: vehicleLng },
        map: googleMapRef.current,
        title: 'Vehicle Location',
        label: {
          text: 'V',
          color: '#fff',
          fontWeight: 'bold',
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3498db',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        animation: (window as any).google.maps.Animation.DROP,
      });
      
      if (!markersRef.current.includes(vehicleMarkerRef.current)) {
        markersRef.current.push(vehicleMarkerRef.current);
      }

      vehicleInfoWindowRef.current = new (window as any).google.maps.InfoWindow({
        content: vehicleInfoContentHtml,
      });
      
      vehicleMarkerRef.current.addListener('click', () => {
        if (vehicleInfoWindowRef.current) {
          vehicleInfoWindowRef.current.open(googleMapRef.current, vehicleMarkerRef.current);
        }
      });
    }

    // Refit map bounds to include pickup, drop-off, and vehicle
    const pickupLatNum = parseCoordinate(pickup?.latitude);
    const pickupLngNum = parseCoordinate(pickup?.longitude);
    const dropoffLatNum = parseCoordinate(dropoff?.latitude);
    const dropoffLngNum = parseCoordinate(dropoff?.longitude);

    const bounds = new (window as any).google.maps.LatLngBounds();
    if (pickupLatNum !== null && pickupLngNum !== null) {
      bounds.extend({ lat: pickupLatNum, lng: pickupLngNum });
    }
    if (dropoffLatNum !== null && dropoffLngNum !== null) {
      bounds.extend({ lat: dropoffLatNum, lng: dropoffLngNum });
    }
    bounds.extend({ lat: vehicleLat, lng: vehicleLng });

    if (!bounds.isEmpty()) {
      googleMapRef.current.fitBounds(bounds);
    }
  }, [mapLoaded, vehicleCoordinates, vehicleLocation, vehicleInfoContentHtml]);

  React.useEffect(() => {
    if (!mapLoaded || !googleMapRef.current || !(window as any).google?.maps) {
      return;
    }
    if (!routePolylineRef.current) {
      return;
    }
    const polylineSource = (routePath && routePath.length >= 2 ? routePath : routeCoordinates)
      .map(point => ({ lat: point.latitude, lng: point.longitude }));
    if (polylineSource.length >= 2) {
      routePolylineRef.current.setPath(polylineSource);
    }
  }, [mapLoaded, routePath, routeCoordinates]);


  if (!mapLoaded) {
    return (
      <View style={styles.mapFallback}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.fallbackText}>Loading Google Maps...</Text>
        <Text style={styles.fallbackSubtext}>Fetching API key from backend...</Text>
      </View>
    );
  }
  
  // Check if Google Maps is actually available (might have failed to load)
  const isGoogleMapsAvailable = typeof window !== 'undefined' && (window as any).google?.maps;
  
  if (!isGoogleMapsAvailable) {
    // Show fallback UI with route info
    return (
      <View style={styles.mapFallback}>
        <Ionicons name="map-outline" size={64} color="#8B5CF6" />
        <Text style={styles.fallbackText}>Google Maps Not Available</Text>
        <Text style={styles.fallbackSubtext}>
          Please ensure the backend has GOOGLE_MAPS_API_KEY configured.
        </Text>
        {pickup && dropoff && (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={styles.routeInfoText}>
              📍 Pickup: {pickup.place || `${pickup.city}, ${pickup.state}`}
            </Text>
            <Text style={styles.routeInfoText}>
              🎯 Drop-off: {dropoff.place || `${dropoff.city}, ${dropoff.state}`}
            </Text>
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={onOpenGoogleMaps}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.openMapsButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Google Maps container */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {enableSpeedWarningDemo && (
        <TouchableOpacity
          onPress={onToggleSpeedDemo}
          style={[
            styles.demoToggleFloating,
            isSpeedDemoActive && styles.demoToggleFloatingActive,
            styles.demoToggleFloatingWeb,
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isSpeedDemoActive ? 'play-back' : 'flash'}
            size={18}
            color="#fff"
          />
          <Text style={styles.demoToggleFloatingText}>
            {isSpeedDemoActive ? 'Hide Demo' : 'Demo Speed Warning'}
          </Text>
        </TouchableOpacity>
      )}

      {warningBanners.length > 0 && (
        <View style={[styles.warningStack, styles.warningStackWeb]}>
          {warningBanners.map((banner, index) => (
            <View
              key={banner.id}
              style={[
                styles.warningBanner,
                banner.type === 'speed'
                  ? styles.warningBannerSpeed
                  : styles.warningBannerFuel,
                index > 0 && styles.warningBannerSpacing,
              ]}
            >
              <Ionicons
                name={banner.icon}
                size={22}
                color="#fff"
                style={styles.warningBannerIcon}
              />
              <View style={styles.warningBannerContent}>
                <Text style={styles.warningBannerTitle}>{banner.title}</Text>
                <Text style={styles.warningBannerMessage}>{banner.message}</Text>
                {banner.note && (
                  <Text style={styles.warningBannerNote}>{banner.note}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Vehicle info overlay */}
      {vehicleLocation && (
        <View style={[styles.webInfoContainer, { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}>
          <View style={styles.webInfoRow}>
            <Text style={styles.webInfoLabel}>Vehicle:</Text>
            <Text style={styles.webInfoValue}>
              {vehicleLocation.plateNumber || vehicleLocation.internalId}
            </Text>
          </View>
          {((vehicleLocation.speed !== undefined && vehicleLocation.speed !== null) || isSpeedDemoActive) && (
            <>
              <View style={styles.webInfoRow}>
                <Text style={styles.webInfoLabel}>Speed:</Text>
                <Text style={[styles.webInfoValue, isSpeedWarningActive ? styles.webInfoValueWarning : undefined]}>
                  {speedDisplayWithUnit}
                  {isSpeedDemoActive ? ' (demo)' : ''}
                </Text>
              </View>
              <View style={styles.webInfoRow}>
                <Text style={styles.webInfoLabel}>Threshold:</Text>
                <Text style={styles.webInfoValue}>{speedLimitWithUnit}</Text>
              </View>
              {isSpeedWarningActive && (
                <View style={styles.webInfoAlert}>
                  <Ionicons name="warning" size={16} color="#fff" style={styles.webInfoAlertIcon} />
                  <Text style={styles.webInfoAlertText}>
                    {isSpeedDemoActive
                      ? `Demo override: showing ${speedWarningExcessValue ?? 0} km/h over the limit.`
                      : `Over by ${speedWarningExcessValue ?? 0} km/h. Reduce speed immediately.`}
                  </Text>
                </View>
              )}
              {isSpeedDemoActive && (
                <Text style={styles.webInfoDemoNote}>
                  Demo mode is active to preview the speed warning while GeoTab data is offline.
                </Text>
              )}
            </>
          )}
          {fuelDisplayText && (
            <View style={styles.webInfoRow}>
              <Text style={styles.webInfoLabel}>Fuel:</Text>
              <Text style={[styles.webInfoValue, isFuelWarningActive ? styles.webInfoValueWarning : undefined]}>
                {fuelDisplayText}
              </Text>
            </View>
          )}
          {vehicleCoordinates && (
            <TouchableOpacity
              style={styles.openMapsButton}
              onPress={onOpenGoogleMaps}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.openMapsButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Route info overlay */}
      {(pickup || dropoff) && (
        <View style={[styles.routeInfoContainer, { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 8, padding: 12 }]}>
          {pickup && (
            <View style={styles.routeInfoItem}>
              <View style={[styles.routeDotWeb, { backgroundColor: '#27ae60' }]} />
              <Text style={styles.routeInfoText}>
                Pickup: {pickup.place || `${pickup.city}, ${pickup.state}`}
              </Text>
            </View>
          )}
          {dropoff && (
            <View style={styles.routeInfoItem}>
              <View style={[styles.routeDotWeb, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.routeInfoText}>
                Drop-off: {dropoff.place || `${dropoff.city}, ${dropoff.state}`}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default MapViewWithLiveTracking;