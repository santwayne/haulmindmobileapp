import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import MapViewWithLiveTracking from '../../components/MapViewWithLiveTracking';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, rs, rf, ri } from "../../theme";

// ─── Responsive scaled constants (computed once at module load) ───────────────
const FS = {
  xs:   rf(FONT_SIZE.xs),
  sm:   rf(FONT_SIZE.sm),
  base: rf(FONT_SIZE.base),
  md:   rf(FONT_SIZE.md),
  lg:   rf(FONT_SIZE.lg),
  xl:   rf(FONT_SIZE.xl),
};
const SP = {
  xs:   rs(SPACING.xs),
  sm:   rs(SPACING.sm),
  md:   rs(SPACING.md),
  base: rs(SPACING.base),
  lg:   rs(SPACING.lg),
  xl:   rs(SPACING.xl),
  '2xl': rs(SPACING['2xl']),
  '3xl': rs(SPACING['3xl']),
};
const RD = {
  sm:   rs(RADIUS.sm),
  md:   rs(RADIUS.md),
  lg:   rs(RADIUS.lg),
  xl:   rs(RADIUS.xl),
  '2xl': rs(RADIUS['2xl']),
  full: RADIUS.full,
};

// Conditionally import DocumentPicker
let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.warn('expo-document-picker not available');
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

interface Trip {
  _id: string;
  tripNumber: string;
  status: string;
  driver?: {
    _id: string;
    name: string;
  };
  truck?: {
    _id: string;
    plateNumber?: string;
    internalId?: string;
    make?: string;
    model?: string;
    yard?: {
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
  trailer?: {
    _id: string;
    plateNumber?: string;
    trailerNumber?: string;
  };
  orders?: Array<{
    _id: string;
    orderNumber: string;
    customerOrderNo?: string;
    status?: string;
    customer?: {
      name?: string;
      email?: string;
    };
    pickupLocation?: {
        place?: string;
      latitude?: string | number;
      longitude?: string | number;
      placeId?: {
        name?: string;
        currentLocation?: {
          address?: string;
          latitude?: string | number;
          longitude?: string | number;
        };
      };
    };
    deliveryLocation?: {
      place?: string;
      latitude?: string | number;
      longitude?: string | number;
      placeId?: {
    name?: string;
        currentLocation?: {
          address?: string;
          latitude?: string | number;
          longitude?: string | number;
        };
      };
    };
    shipper?: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      unit?: string;
      country?: string;
      province?: string;
      city?: string;
      postalCode?: string;
      primaryPhone?: string;
      secondaryPhone?: string;
      contact?: string;
      store?: string;
      type?: string;
    };
    receiver?: {
      name?: string;
      phone?: string;
      address?: string;
      contact?: string;
    };
    stops?: Array<{
      stop?: number;
      shipper?: string;
      date?: string;
      endDate?: string;
      appointment?: string;
      pickUpNumber?: string;
      contact?: string;
      skids?: string;
      cases?: string;
      weight?: string;
      uom?: string;
      temperature?: string;
      address?: string;
      ltl?: boolean;
    }>;
    receiverStops?: Array<{
      stop?: number;
      receiver?: string;
      date?: string;
      endDate?: string;
      appointment?: string;
      dropOffNumber?: string;
      contact?: string;
      skids?: string;
      cases?: string;
      weight?: string;
      uom?: string;
      temperature?: string;
      address?: string;
      ltl?: boolean;
    }>;
    pickupDate?: string;
    deliveryDate?: string;
    pickupAppointment?: {
      type?: string;
      date?: string;
      time?: string;
    };
    deliveryAppointment?: {
      date?: string;
      time?: string;
    };
    pickupAppointmentDetails?: {
      type?: string;
      date?: string;
      time?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
      specialInstructions?: string;
      gatePass?: string;
    };
    deliveryAppointmentDetails?: {
      type?: string;
      date?: string;
      time?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
      unloadingInstructions?: string;
    };
  }>;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  notes?: string;
  documents?: Array<{
    _id?: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    type?: string;
    uploadedBy?: any;
    uploadedAt?: string;
    description?: string;
  }>;
  route?: {
    totalDistance?: number;
    estimatedDuration?: number;
    waypoints?: Array<{
      place: string;
      latitude: string | number;
      longitude: string | number;
      order?: string;
      type: 'pickup' | 'delivery' | 'stop';
    }>;
  };
}

// Helper to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper to convert trip to load-like structure for MapViewWithLiveTracking
const convertTripToLoadForMap = (trip: Trip) => {
  if (!trip.orders || trip.orders.length === 0) {
    return null;
  }

  const parseCoord = (val: any): number | null => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const getLocationCoords = (location: any) => {
    if (!location) return { lat: null, lng: null };
    
    let lat = parseCoord(location.latitude);
    let lng = parseCoord(location.longitude);
    
    if ((lat === null || lng === null) && location.placeId?.currentLocation) {
      lat = parseCoord(location.placeId.currentLocation.latitude);
      lng = parseCoord(location.placeId.currentLocation.longitude);
    }
    
    return { lat, lng };
  };

  // Check if trip has optimized route waypoints from backend
  if ((trip as any).route?.waypoints && Array.isArray((trip as any).route.waypoints) && (trip as any).route.waypoints.length > 0) {
    // Use backend-optimized waypoints
    const optimizedWaypoints = (trip as any).route.waypoints.map((wp: any) => {
      const lat = parseCoord(wp.latitude);
      const lng = parseCoord(wp.longitude);
      
      if (lat === null || lng === null) return null;
      
      return {
        address: {
          place: wp.place || 'Waypoint',
          latitude: lat,
          longitude: lng,
        },
        pickup: wp.type === 'pickup',
        dropOff: wp.type === 'delivery',
      };
    }).filter((wp: any) => wp !== null);

    const firstOrder = trip.orders[0];
    const lastOrder = trip.orders[trip.orders.length - 1];
    const pickup = firstOrder.pickupLocation;
    const dropoff = lastOrder.deliveryLocation;
    const pickupCoords = getLocationCoords(pickup);
    const dropoffCoords = getLocationCoords(dropoff);

    return {
      _id: trip._id,
      internalId: trip.tripNumber,
      route: {
        multipleDropOffs: trip.orders.length > 1,
        selectPickup: {
          place: pickup?.place || pickup?.placeId?.name || 'Pickup',
          latitude: pickupCoords.lat !== null ? pickupCoords.lat : undefined,
          longitude: pickupCoords.lng !== null ? pickupCoords.lng : undefined,
        },
        selectDropOff: {
          place: dropoff?.place || dropoff?.placeId?.name || 'Delivery',
          latitude: dropoffCoords.lat !== null ? dropoffCoords.lat : undefined,
          longitude: dropoffCoords.lng !== null ? dropoffCoords.lng : undefined,
        },
        wayPoints: optimizedWaypoints,
      },
      vehicle: trip.truck ? {
        _id: trip.truck._id,
        internalId: trip.truck.internalId || trip.truck.plateNumber || '',
        plateNumber: trip.truck.plateNumber,
        trackingKey: (trip.truck as any).trackingKey, // Include trackingKey for vehicle tracking
      } : undefined,
    };
  }

  // Build optimized waypoints from orders including multiple stops
  // For multiple orders: All Pickups (main + stops) -> All Deliveries (main + receiverStops)
  const wayPoints: Array<{
    address: {
      place: string;
      latitude: number | string | null;
      longitude: number | string | null;
    };
    pickup?: boolean;
    dropOff?: boolean;
    orderId?: string;
    orderNumber?: string;
    stopNumber?: number;
    stopType?: 'main' | 'additional';
  }> = [];

  // Helper to parse coordinates from stop address
  const getStopCoords = (stop: any, order: any) => {
    if (!stop) return { lat: null, lng: null };
    
    // Try address field first (if address is an object with lat/lng)
    if (stop.address && typeof stop.address === 'object') {
      const lat = parseCoord(stop.address.latitude || stop.address.lat);
      const lng = parseCoord(stop.address.longitude || stop.address.lng);
      if (lat !== null && lng !== null) return { lat, lng };
    }
    
    // Try latitude/longitude directly on stop
    const lat = parseCoord(stop.latitude || stop.lat);
    const lng = parseCoord(stop.longitude || stop.lng);
    if (lat !== null && lng !== null) return { lat, lng };
    
    // If no coordinates, try to use main pickup/delivery location as fallback
    // For pickup stops, use main pickup location
    // For delivery stops, use main delivery location
    if (stop.address && typeof stop.address === 'string') {
      // Try to match with main locations
      if (order.pickupLocation) {
        const pickupCoords = getLocationCoords(order.pickupLocation);
        if (pickupCoords.lat !== null && pickupCoords.lng !== null) {
          console.warn(`⚠️ Stop "${stop.address}" missing coordinates, using main pickup location as fallback`);
          return pickupCoords;
        }
      }
      if (order.deliveryLocation) {
        const deliveryCoords = getLocationCoords(order.deliveryLocation);
        if (deliveryCoords.lat !== null && deliveryCoords.lng !== null) {
          console.warn(`⚠️ Stop "${stop.address}" missing coordinates, using main delivery location as fallback`);
          return deliveryCoords;
        }
      }
    }
    
    return { lat: null, lng: null };
  };

  // First, collect all pickups and deliveries with their order info
  const allLocations: Array<{
    address: {
      place: string;
      latitude: number;
      longitude: number;
    };
    pickup: boolean;
    dropOff: boolean;
    orderId: string;
    orderNumber: string;
    index: number;
    stopNumber?: number;
    stopType: 'main' | 'additional';
  }> = [];

  trip.orders.forEach((order, orderIndex) => {
    // Main pickup location
    const pickupLoc = order.pickupLocation;
    const pickupCoords = getLocationCoords(pickupLoc);

    if (pickupCoords.lat !== null && pickupCoords.lng !== null) {
      allLocations.push({
        address: {
          place: pickupLoc?.place || pickupLoc?.placeId?.name || order.shipper?.address || `Pickup ${orderIndex + 1}`,
          latitude: pickupCoords.lat,
          longitude: pickupCoords.lng,
        },
        pickup: true,
        dropOff: false,
        orderId: order._id,
        orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
        index: orderIndex,
        stopType: 'main',
      });
    }

    // Additional pickup stops
    if (order.stops && Array.isArray(order.stops) && order.stops.length > 0) {
      console.log(`📍 Order ${order.orderNumber || orderIndex + 1} - Found ${order.stops.length} pickup stops:`, order.stops);
      order.stops.forEach((stop: any, stopIndex: number) => {
        const stopCoords = getStopCoords(stop, order);
        console.log(`  🛑 Pickup Stop ${stopIndex + 1}:`, {
          stop: stop.stop,
          address: stop.address,
          shipper: stop.shipper,
          coords: stopCoords,
          stopData: stop
        });
        if (stopCoords.lat !== null && stopCoords.lng !== null) {
          allLocations.push({
            address: {
              place: stop.address || stop.shipper || `Pickup Stop ${stop.stop || stopIndex + 1}`,
              latitude: stopCoords.lat,
              longitude: stopCoords.lng,
            },
            pickup: true,
            dropOff: false,
            orderId: order._id,
            orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
            index: orderIndex,
            stopNumber: stop.stop || stopIndex + 1,
            stopType: 'additional',
          });
          console.log(`  ✅ Added pickup stop ${stop.stop || stopIndex + 1} to waypoints`);
        } else {
          console.warn(`  ⚠️ Pickup stop ${stopIndex + 1} missing coordinates - address: "${stop.address}"`);
          // Still add the stop with a warning, but use main pickup location as fallback
          const fallbackCoords = getLocationCoords(order.pickupLocation);
          if (fallbackCoords.lat !== null && fallbackCoords.lng !== null) {
            console.log(`  📍 Using main pickup location as fallback for stop ${stopIndex + 1}`);
            allLocations.push({
              address: {
                place: stop.address || stop.shipper || `Pickup Stop ${stop.stop || stopIndex + 1}`,
                latitude: fallbackCoords.lat,
                longitude: fallbackCoords.lng,
              },
              pickup: true,
              dropOff: false,
              orderId: order._id,
              orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
              index: orderIndex,
              stopNumber: stop.stop || stopIndex + 1,
              stopType: 'additional',
            });
          }
        }
      });
    }

    // Main delivery location
    const deliveryLoc = order.deliveryLocation;
    const deliveryCoords = getLocationCoords(deliveryLoc);

    if (deliveryCoords.lat !== null && deliveryCoords.lng !== null) {
      allLocations.push({
        address: {
          place: deliveryLoc?.place || deliveryLoc?.placeId?.name || order.receiver?.address || `Delivery ${orderIndex + 1}`,
          latitude: deliveryCoords.lat,
          longitude: deliveryCoords.lng,
        },
        pickup: false,
        dropOff: true,
        orderId: order._id,
        orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
        index: orderIndex,
        stopType: 'main',
      });
    }

    // Additional delivery stops (receiverStops)
    if (order.receiverStops && Array.isArray(order.receiverStops) && order.receiverStops.length > 0) {
      console.log(`📍 Order ${order.orderNumber || orderIndex + 1} - Found ${order.receiverStops.length} delivery stops:`, order.receiverStops);
      order.receiverStops.forEach((stop: any, stopIndex: number) => {
        const stopCoords = getStopCoords(stop, order);
        console.log(`  🛑 Delivery Stop ${stopIndex + 1}:`, {
          stop: stop.stop,
          address: stop.address,
          receiver: stop.receiver,
          coords: stopCoords,
          stopData: stop
        });
        if (stopCoords.lat !== null && stopCoords.lng !== null) {
          allLocations.push({
            address: {
              place: stop.address || stop.receiver || `Delivery Stop ${stop.stop || stopIndex + 1}`,
              latitude: stopCoords.lat,
              longitude: stopCoords.lng,
            },
            pickup: false,
            dropOff: true,
            orderId: order._id,
            orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
            index: orderIndex,
            stopNumber: stop.stop || stopIndex + 1,
            stopType: 'additional',
          });
          console.log(`  ✅ Added delivery stop ${stop.stop || stopIndex + 1} to waypoints`);
        } else {
          console.warn(`  ⚠️ Delivery stop ${stopIndex + 1} missing coordinates - address: "${stop.address}"`);
          // Still add the stop with a warning, but use main delivery location as fallback
          const fallbackCoords = getLocationCoords(order.deliveryLocation);
          if (fallbackCoords.lat !== null && fallbackCoords.lng !== null) {
            console.log(`  📍 Using main delivery location as fallback for stop ${stopIndex + 1}`);
            allLocations.push({
              address: {
                place: stop.address || stop.receiver || `Delivery Stop ${stop.stop || stopIndex + 1}`,
                latitude: fallbackCoords.lat,
                longitude: fallbackCoords.lng,
              },
              pickup: false,
              dropOff: true,
              orderId: order._id,
              orderNumber: order.orderNumber || `Order ${orderIndex + 1}`,
              index: orderIndex,
              stopNumber: stop.stop || stopIndex + 1,
              stopType: 'additional',
            });
          }
        }
      });
    }
  });

  // Sort locations: all pickups first (maintaining order), then all deliveries (maintaining order)
  // This ensures we pick up all orders before delivering any
  const sortedLocations = [
    ...allLocations.filter(loc => loc.pickup).sort((a, b) => a.index - b.index),
    ...allLocations.filter(loc => loc.dropOff).sort((a, b) => a.index - b.index),
  ];

  sortedLocations.forEach((loc) => {
    const waypoint = {
      address: {
        place: loc.address.place,
        latitude: loc.address.latitude,
        longitude: loc.address.longitude,
      },
      pickup: loc.pickup,
      dropOff: loc.dropOff,
      orderId: loc.orderId,
      orderNumber: loc.orderNumber,
      stopNumber: loc.stopNumber,
      stopType: loc.stopType,
    };
    console.log('📌 Adding waypoint to array:', {
      place: waypoint.address.place,
      latitude: waypoint.address.latitude,
      longitude: waypoint.address.longitude,
      stopNumber: waypoint.stopNumber,
      stopType: waypoint.stopType,
      isPickup: waypoint.pickup,
      isDropoff: waypoint.dropOff,
    });
    wayPoints.push(waypoint);
  });
  
  console.log('📋 Final wayPoints array:', {
    total: wayPoints.length,
    waypoints: wayPoints.map(wp => ({
      place: wp.address.place,
      lat: wp.address.latitude,
      lng: wp.address.longitude,
      stopNumber: wp.stopNumber,
      stopType: wp.stopType,
    }))
  });

  // Log final waypoints with stops
  const stopsCount = wayPoints.filter(wp => wp.stopType === 'additional').length;
  console.log('🗺️ Final waypoints summary:', {
    total: wayPoints.length,
    main: wayPoints.filter(wp => wp.stopType === 'main').length,
    additional: stopsCount,
    pickupStops: wayPoints.filter(wp => wp.pickup && wp.stopType === 'additional').length,
    deliveryStops: wayPoints.filter(wp => wp.dropOff && wp.stopType === 'additional').length,
    waypoints: wayPoints.map(wp => ({
      place: wp.address.place,
      stopNumber: wp.stopNumber,
      stopType: wp.stopType,
      pickup: wp.pickup,
      dropOff: wp.dropOff
    }))
  });

  // Get first pickup and last delivery for selectPickup/selectDropOff
  const firstPickup = sortedLocations.find(loc => loc.pickup);
  const lastDelivery = sortedLocations.filter(loc => loc.dropOff).pop();

  const pickup = firstPickup ? trip.orders.find(o => o._id === firstPickup.orderId)?.pickupLocation : trip.orders[0]?.pickupLocation;
  const dropoff = lastDelivery ? trip.orders.find(o => o._id === lastDelivery.orderId)?.deliveryLocation : trip.orders[trip.orders.length - 1]?.deliveryLocation;
  const pickupCoords = getLocationCoords(pickup);
  const dropoffCoords = getLocationCoords(dropoff);

  // Get yard location from trip (either from yardLocation or truck.yard)
  let yardLocation = trip.yardLocation;
  if (!yardLocation && trip.truck?.yard?.coordinates) {
    const yard = trip.truck.yard;
    if (yard.coordinates?.latitude && yard.coordinates?.longitude) {
      yardLocation = {
        yardName: yard.yardName || 'Yard',
        yardCode: yard.yardCode || '',
        address: yard.address || '',
        city: yard.city || '',
        stateProvince: yard.stateProvince || '',
        coordinates: {
          latitude: parseFloat(String(yard.coordinates.latitude)) || null,
          longitude: parseFloat(String(yard.coordinates.longitude)) || null,
        }
      };
    }
  }

  console.log('🏭 Yard location for trip:', {
    hasYardLocation: !!yardLocation,
    yardName: yardLocation?.yardName,
    coordinates: yardLocation?.coordinates
  });

  return {
    _id: trip._id,
    internalId: trip.tripNumber,
    route: {
      multipleDropOffs: trip.orders.length > 1,
      selectPickup: {
        place: pickup?.place || pickup?.placeId?.name || 'Pickup',
        latitude: pickupCoords.lat !== null ? pickupCoords.lat : undefined,
        longitude: pickupCoords.lng !== null ? pickupCoords.lng : undefined,
      },
      selectDropOff: {
        place: dropoff?.place || dropoff?.placeId?.name || 'Delivery',
        latitude: dropoffCoords.lat !== null ? dropoffCoords.lat : undefined,
        longitude: dropoffCoords.lng !== null ? dropoffCoords.lng : undefined,
      },
      wayPoints: (() => {
        const filtered = wayPoints.filter(wp => {
          const hasValidCoords = wp.address.latitude !== null && wp.address.longitude !== null;
          if (!hasValidCoords) {
            console.warn('⚠️ Filtering out waypoint with invalid coordinates:', {
              place: wp.address.place,
              latitude: wp.address.latitude,
              longitude: wp.address.longitude,
              stopNumber: wp.stopNumber,
              stopType: wp.stopType,
            });
          }
          return hasValidCoords;
        });
        
        const mapped = filtered.map(wp => {
          const result = {
            address: {
              place: wp.address.place,
              latitude: wp.address.latitude !== null ? wp.address.latitude : undefined,
              longitude: wp.address.longitude !== null ? wp.address.longitude : undefined,
            },
            pickup: wp.pickup,
            dropOff: wp.dropOff,
            stopNumber: wp.stopNumber,
            stopType: wp.stopType,
          };
          console.log('✅ Mapped waypoint for map:', {
            place: result.address.place,
            lat: result.address.latitude,
            lng: result.address.longitude,
            stopNumber: result.stopNumber,
            stopType: result.stopType,
            isPickup: result.pickup,
            isDropoff: result.dropOff,
          });
          return result;
        });
        
        console.log('📤 Returning waypoints to map component:', {
          total: wayPoints.length,
          filtered: filtered.length,
          mapped: mapped.length,
          waypoints: mapped.map(wp => ({
            place: wp.address.place,
            lat: wp.address.latitude,
            lng: wp.address.longitude,
            stopNumber: wp.stopNumber,
            stopType: wp.stopType,
          }))
        });
        
        return mapped;
      })(),
    },
    vehicle: trip.truck ? {
      _id: trip.truck._id,
      internalId: trip.truck.internalId || trip.truck.plateNumber || '',
      plateNumber: trip.truck.plateNumber,
      trackingKey: (trip.truck as any).trackingKey, // Include trackingKey for vehicle tracking
    } : undefined,
    yardLocation: yardLocation, // Include yard location for starting point
  };
};

const ActiveTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedTripForMap, setSelectedTripForMap] = useState<Trip | null>(null);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [selectedTripForCompletion, setSelectedTripForCompletion] = useState<Trip | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedPodFile, setSelectedPodFile] = useState<any>(null);
  const [selectedManifestFile, setSelectedManifestFile] = useState<any>(null);
  const navigation = useNavigation<NavigationProp>();

  // Split trips into active and pending approval
  // Check if trip or any of its orders have pending review status
  const hasPendingReviewStatus = (trip: Trip) => {
    // Check trip status
    if (
      trip.status === 'pending_review' || 
      trip.status === 'verification_pending' ||
      trip.status === 'pending_completion' ||
      trip.status === 'pending-completion'
    ) {
      return true;
    }
    
    // Check order statuses
    if (trip.orders && trip.orders.length > 0) {
      return trip.orders.some(order => 
        order.status === 'pending_review' || 
        order.status === 'verification_pending' ||
        order.status === 'pending_completion'
      );
    }
    
    return false;
  };
  
  const activeTrips = trips.filter(trip => !hasPendingReviewStatus(trip));
  const pendingApprovalTrips = trips.filter(trip => hasPendingReviewStatus(trip));

  // Fetch trips when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Active Trips screen focused - fetching trips...');
      fetchActiveTrips();
      
      // Cleanup function (optional)
      return () => {
        console.log('🔄 Active Trips screen unfocused');
      };
    }, [])
  );

  const fetchActiveTrips = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching trips with in-progress and pending_review statuses...');
      
      // Fetch trips with both in-progress and pending_review statuses
      const [inProgressResponse, pendingReviewResponse] = await Promise.all([
        apiService.getActiveTrips(), // Gets in-progress trips
        apiService.getPendingReviewTrips(), // Gets pending_review trips
      ]);
      
      console.log('📊 In-progress response:', inProgressResponse);
      console.log('📊 Pending review response:', pendingReviewResponse);
      
      let allTrips: any[] = [];
      
      // Combine in-progress trips
      if (inProgressResponse.success && inProgressResponse.data) {
        const inProgressTrips = inProgressResponse.data.data || inProgressResponse.data || [];
        allTrips = [...allTrips, ...inProgressTrips];
        console.log('✅ In-progress trips:', inProgressTrips.length);
      }
      
      // Combine pending_review trips
      if (pendingReviewResponse.success && pendingReviewResponse.data) {
        const pendingTrips = pendingReviewResponse.data.data || pendingReviewResponse.data || [];
        allTrips = [...allTrips, ...pendingTrips];
        console.log('✅ Pending review trips:', pendingTrips.length);
      }
      
      // Remove duplicates based on _id (in case same trip appears in both)
      const uniqueTrips = allTrips.filter((trip, index, self) => 
        index === self.findIndex((t) => t._id === trip._id)
      );
      
      setTrips(Array.isArray(uniqueTrips) ? uniqueTrips : []);
      logger.info('All trips fetched', { 
        total: uniqueTrips.length,
        inProgress: inProgressResponse.success ? (inProgressResponse.data?.data?.length || 0) : 0,
        pendingReview: pendingReviewResponse.success ? (pendingReviewResponse.data?.data?.length || 0) : 0
      });
      console.log('📋 Total trips loaded:', uniqueTrips.length);
      
    } catch (error) {
      logger.error('Error fetching active trips', error);
      console.error('❌ Error fetching trips:', error);
      setTrips([]);
      Alert.alert('Error', 'Failed to load trips. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveTrips();
  };

  const handleCompleteTrip = async (tripId: string) => {
    // Find the trip to check documents
    const trip = trips.find(t => t._id === tripId);
    
    if (!trip) {
      Alert.alert('Error', 'Trip not found');
      return;
    }

    // Open completion modal
    setSelectedTripForCompletion(trip);
    setCompletionModalVisible(true);
  };

  const handleSelectFile = async (documentType: string) => {
    if (!DocumentPicker || !DocumentPicker.getDocumentAsync) {
      Alert.alert(
        'Feature Not Available',
        'Document picker requires a custom development build. Please build the app using "npx expo run:android" or "npx expo run:ios" for full functionality.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || 'document.pdf',
          type: asset.mimeType || 'application/pdf',
          size: asset.size,
        });
        setSelectedDocumentType(documentType);
        logger.info('File selected for trip document', { name: asset.name, type: documentType });
      }
    } catch (error: any) {
      logger.error('Error selecting file', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const handleUploadDocument = async (tripId: string, documentType: string) => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file first');
      return;
    }

    try {
      setUploadingDocument(true);
      const response = await apiService.uploadTripDocument(tripId, selectedFile, documentType);
      
      if (response.success) {
        Alert.alert('Success', 'Document uploaded successfully');
        setSelectedFile(null);
        setSelectedDocumentType('');
        // Refresh trip data
        fetchActiveTrips();
      } else {
        Alert.alert('Error', response.error || 'Failed to upload document');
      }
    } catch (error) {
      logger.error('Error uploading trip document', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSubmitCompletion = async () => {
    if (!selectedTripForCompletion) return;

    const trip = selectedTripForCompletion;
    const order = trip.orders && trip.orders.length > 0 ? trip.orders[0] : null;
    
    if (!order) {
      Alert.alert('Error', 'No order found for this trip');
      return;
    }

    try {
      setUploadingDocument(true);
      console.log('🚀 Starting document upload and completion process...');

      // Check existing attachments
      const attachments = order.attachments || [];
      const hasPOD = attachments.some((att: any) => 
        att.type === 'pod' || att.type === 'proof_of_delivery'
      );
      const hasManifest = attachments.some((att: any) => 
        att.type === 'border_manifest' || att.type === 'manifest'
      );

      console.log('📊 Document status - POD:', hasPOD, 'Manifest:', hasManifest);
      console.log('📂 Selected files - POD:', selectedPodFile?.name, 'Manifest:', selectedManifestFile?.name);

      // Upload POD if selected and not already uploaded
      if (selectedPodFile && !hasPOD) {
        console.log('📤 Uploading POD document...');
        const podResponse = await apiService.uploadOrderDocument(order._id, selectedPodFile, 'pod');
        console.log('📤 POD upload response:', podResponse);
        
        if (!podResponse.success) {
          throw new Error(podResponse.error || podResponse.message || 'Failed to upload POD');
        }
      }

      // Upload Manifest if selected and not already uploaded
      if (selectedManifestFile && !hasManifest) {
        console.log('📤 Uploading Manifest document...');
        const manifestResponse = await apiService.uploadOrderDocument(order._id, selectedManifestFile, 'border_manifest');
        console.log('📤 Manifest upload response:', manifestResponse);
        
        if (!manifestResponse.success) {
          throw new Error(manifestResponse.error || manifestResponse.message || 'Failed to upload Manifest');
        }
      }

      // Complete the order (this will set status to pending_review)
      console.log('✅ Completing order...');
      const completeResponse = await apiService.completeOrder(order._id);
      console.log('✅ Complete order response:', completeResponse);

      if (completeResponse.success) {
        setCompletionModalVisible(false);
        setSelectedTripForCompletion(null);
        setSelectedPodFile(null);
        setSelectedManifestFile(null);
        fetchActiveTrips();
        
        setTimeout(() => {
          Alert.alert(
            'Success',
            'Documents uploaded successfully! Your order is now pending dispatcher approval.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('MainTabs', { screen: 'Dashboard' });
                },
              },
            ]
          );
        }, 800);
      } else {
        Alert.alert('Error', completeResponse.error || completeResponse.message || 'Failed to complete order');
      }
    } catch (error: any) {
      console.error('❌ Error in handleSubmitCompletion:', error);
      logger.error('Error completing order', error);
      Alert.alert('Error', error.message || 'Failed to submit for review. Please try again.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const formatAddress = (location: any) => {
    if (!location) return 'N/A';
    if (location.place) return location.place;
    if (location.placeId?.name) return location.placeId.name;
    if (location.placeId?.currentLocation?.address) return location.placeId.currentLocation.address;
    return 'Unknown Location';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "in-progress": return "#27ae60";
      case "in-delivery": return "#3498db";
      case "completed": return "#2ecc71";
      case "pending_completion":
      case "pending-completion": return "#f59e0b"; // Amber - waiting for approval
      case "planned": return "#95a5a6";
      default: return "#95a5a6";
    }
  };

  const canShowMap = (trip: Trip) => {
    if (!trip.orders || trip.orders.length === 0) return false;
    
    const firstOrder = trip.orders[0];
    const pickup = firstOrder.pickupLocation;
    
    const parseCoord = (val: any): number | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    const getLat = (loc: any) => {
      if (!loc) return null;
      return parseCoord(loc.latitude) || parseCoord(loc.placeId?.currentLocation?.latitude);
    };

    const getLng = (loc: any) => {
      if (!loc) return null;
      return parseCoord(loc.longitude) || parseCoord(loc.placeId?.currentLocation?.longitude);
    };

    const pickupLat = getLat(pickup);
    const pickupLng = getLng(pickup);

    if (pickupLat === null || pickupLng === null) return false;

    // Check if at least one order has delivery location
    return trip.orders.some(order => {
      const deliveryLat = getLat(order.deliveryLocation);
      const deliveryLng = getLng(order.deliveryLocation);
      return deliveryLat !== null && deliveryLng !== null;
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
          <Text style={styles.loadingText}>Loading active trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Compact header ── */}
      <View style={styles.header}>
        <View style={styles.headerGlowLine} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>My Trips</Text>
            <Text style={styles.headerSubtitle}>Monitor your trips in real-time</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activeTrips.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: COLORS.accentOrange }]}>{pendingApprovalTrips.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚛</Text>
          <Text style={styles.emptyText}>No Trips</Text>
          <Text style={styles.emptySubtext}>You don't have any trips at the moment</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Pending Approval Section */}
          {pendingApprovalTrips.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📋 Pending Approval</Text>
                <Text style={styles.sectionSubtitle}>Waiting for dispatcher verification</Text>
              </View>
              {pendingApprovalTrips.map((trip) => {
            const loadForMap = convertTripToLoadForMap(trip);
            const hasMap = loadForMap !== null && canShowMap(trip);
    
    return (
              <View key={trip._id} style={[styles.tripCard, styles.pendingCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
                    <Text style={styles.tripNumber}>{trip.tripNumber}</Text>
                    <Text style={styles.tripDate}>
                      Started: {formatDate(trip.actualStartDate || trip.plannedStartDate)}
            </Text>
          </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#f39c12' }]}>
                    <Text style={styles.statusText}>Pending Approval</Text>
          </View>
        </View>

                {trip.truck && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Truck:</Text>
                    <Text style={styles.infoValue}>
                      {trip.truck.plateNumber || trip.truck.internalId || 'N/A'}
                    </Text>
                  </View>
                )}

                {trip.trailer && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trailer:</Text>
                    <Text style={styles.infoValue}>
                      {trip.trailer.plateNumber || trip.trailer.trailerNumber || 'N/A'}
                    </Text>
              </View>
                )}

                {trip.orders && trip.orders.length > 0 && (
                  <View style={styles.ordersSection}>
                    <Text style={styles.ordersTitle}>
                      Orders ({trip.orders.length}):
                    </Text>
                    <Text style={styles.pendingNote}>
                      ✓ Documents uploaded and awaiting dispatcher verification
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
            </View>
          )}

          {/* Active Trips Section */}
          {activeTrips.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🚛 Active Trips</Text>
                <Text style={styles.sectionSubtitle}>Your ongoing deliveries</Text>
              </View>
              {activeTrips.map((trip) => {
            const loadForMap = convertTripToLoadForMap(trip);
            const hasMap = loadForMap !== null && canShowMap(trip);
    
    return (
              <View key={trip._id} style={styles.tripCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
                    <Text style={styles.tripNumber}>{trip.tripNumber}</Text>
                    <Text style={styles.tripDate}>
                      Started: {formatDate(trip.actualStartDate || trip.plannedStartDate)}
            </Text>
          </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                    <Text style={styles.statusText}>
                      {trip.status === 'pending_completion' || trip.status === 'pending-completion' 
                        ? 'Pending Approval' 
                        : trip.status || 'Active'}
                    </Text>
          </View>
        </View>

                {trip.truck && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Truck:</Text>
                    <Text style={styles.infoValue}>
                      {trip.truck.plateNumber || trip.truck.internalId || 'N/A'}
                    </Text>
                  </View>
                )}

                {trip.trailer && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trailer:</Text>
                    <Text style={styles.infoValue}>
                      {trip.trailer.plateNumber || trip.trailer.trailerNumber || 'N/A'}
                    </Text>
              </View>
                )}

                {trip.orders && trip.orders.length > 0 && (
                  <View style={styles.ordersSection}>
                    <Text style={styles.ordersTitle}>
                      Orders ({trip.orders.length}):
                    </Text>
                    {trip.orders.map((order, index) => (
                      <View key={order._id || index} style={styles.orderItem}>
                        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                        {order.customerOrderNo && (
                          <Text style={styles.customerOrderNo}>
                            Customer Order: {order.customerOrderNo}
                          </Text>
                        )}
                        {order.customer?.name && (
                          <Text style={styles.customerName}>Customer: {order.customer.name}</Text>
                        )}
                        
                        {/* Shipper Information */}
                        <View style={styles.sectionDivider}>
                          <Text style={styles.sectionTitle}>Shipper Information</Text>
                        </View>
                        {order.shipper?.name && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Name:</Text>
                            <Text style={styles.infoValue}>{order.shipper.name}</Text>
                          </View>
                        )}
                        {order.shipper?.phone && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Phone:</Text>
                            <Text style={styles.infoValue}>{order.shipper.phone}</Text>
                          </View>
                        )}
                        {order.shipper?.contact && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Contact:</Text>
                            <Text style={styles.infoValue}>{order.shipper.contact}</Text>
                          </View>
                        )}
                        <View style={styles.locationRow}>
                          <Text style={styles.locationLabel}>Address: </Text>
                          <Text style={styles.locationValue}>
                            {order.shipper?.address || formatAddress(order.pickupLocation) || 'N/A'}
                          </Text>
                        </View>
                        {order.shipper?.city && order.shipper?.province && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>City/Province:</Text>
                            <Text style={styles.infoValue}>
                              {order.shipper.city}, {order.shipper.province}
                            </Text>
                          </View>
                        )}
                        {order.shipper?.postalCode && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Postal Code:</Text>
                            <Text style={styles.infoValue}>{order.shipper.postalCode}</Text>
                          </View>
                        )}
                        
                        {/* Multiple Pickup Stops */}
                        {order.stops && order.stops.length > 0 && (
                          <View style={styles.stopsSection}>
                            <Text style={styles.stopsTitle}>Additional Pickup Stops ({order.stops.length}):</Text>
                            {order.stops.map((stop: any, stopIndex: number) => (
                              <View key={stopIndex} style={styles.stopItem}>
                                <Text style={styles.stopNumber}>Stop {stop.stop || stopIndex + 1}</Text>
                                {stop.shipper && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Shipper:</Text>
                                    <Text style={styles.infoValue}>{stop.shipper}</Text>
                                  </View>
                                )}
                                {stop.address && (
                                  <View style={styles.locationRow}>
                                    <Text style={styles.locationLabel}>Address:</Text>
                                    <Text style={styles.locationValue}>{stop.address}</Text>
                                  </View>
                                )}
                                {stop.contact && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Contact:</Text>
                                    <Text style={styles.infoValue}>{stop.contact}</Text>
                                  </View>
                                )}
                                {stop.date && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Date:</Text>
                                    <Text style={styles.infoValue}>{stop.date}</Text>
                                  </View>
                                )}
                                {stop.appointment && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Appointment:</Text>
                                    <Text style={styles.infoValue}>{stop.appointment}</Text>
                                  </View>
                                )}
                                {stop.pickUpNumber && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Pickup #:</Text>
                                    <Text style={styles.infoValue}>{stop.pickUpNumber}</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                        
                        {/* Pickup Appointment Details */}
                        {(order.pickupAppointment || order.pickupDate) && (
                          <View style={styles.appointmentSection}>
                            <Text style={styles.appointmentTitle}>Pickup Appointment Details</Text>
                            {order.pickupAppointment?.type && (
                              <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Type:</Text>
                                <Text style={styles.infoValue}>{order.pickupAppointment.type}</Text>
                              </View>
                            )}
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Date:</Text>
                              <Text style={styles.infoValue}>
                                {order.pickupAppointment?.date 
                                  ? formatDateOnly(order.pickupAppointment.date)
                                  : order.pickupDate 
                                  ? formatDateOnly(order.pickupDate)
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Time:</Text>
                              <Text style={styles.infoValue}>
                                {order.pickupAppointment?.time 
                                  ? order.pickupAppointment.time
                                  : order.pickupDate 
                                  ? formatTime(order.pickupDate)
                                  : 'N/A'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Receiver Information */}
                        <View style={styles.sectionDivider}>
                          <Text style={styles.sectionTitle}>Receiver Information</Text>
                        </View>
                        {order.receiver?.name && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Name:</Text>
                            <Text style={styles.infoValue}>{order.receiver.name}</Text>
                          </View>
                        )}
                        {order.receiver?.phone && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Phone:</Text>
                            <Text style={styles.infoValue}>{order.receiver.phone}</Text>
                          </View>
                        )}
                        {order.receiver?.contact && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Contact:</Text>
                            <Text style={styles.infoValue}>{order.receiver.contact}</Text>
                          </View>
                        )}
                        <View style={styles.locationRow}>
                          <Text style={styles.locationLabel}>Address: </Text>
                          <Text style={styles.locationValue}>
                            {order.receiver?.address || formatAddress(order.deliveryLocation) || 'N/A'}
                          </Text>
                        </View>
                        
                        {/* Multiple Delivery Stops */}
                        {order.receiverStops && order.receiverStops.length > 0 && (
                          <View style={styles.stopsSection}>
                            <Text style={styles.stopsTitle}>Additional Delivery Stops ({order.receiverStops.length}):</Text>
                            {order.receiverStops.map((stop: any, stopIndex: number) => (
                              <View key={stopIndex} style={styles.stopItem}>
                                <Text style={styles.stopNumber}>Stop {stop.stop || stopIndex + 1}</Text>
                                {stop.receiver && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Receiver:</Text>
                                    <Text style={styles.infoValue}>{stop.receiver}</Text>
                                  </View>
                                )}
                                {stop.address && (
                                  <View style={styles.locationRow}>
                                    <Text style={styles.locationLabel}>Address:</Text>
                                    <Text style={styles.locationValue}>{stop.address}</Text>
                                  </View>
                                )}
                                {stop.contact && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Contact:</Text>
                                    <Text style={styles.infoValue}>{stop.contact}</Text>
                                  </View>
                                )}
                                {stop.date && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Date:</Text>
                                    <Text style={styles.infoValue}>{stop.date}</Text>
                                  </View>
                                )}
                                {stop.appointment && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Appointment:</Text>
                                    <Text style={styles.infoValue}>{stop.appointment}</Text>
                                  </View>
                                )}
                                {stop.dropOffNumber && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Drop-off #:</Text>
                                    <Text style={styles.infoValue}>{stop.dropOffNumber}</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                        
                        {/* Delivery Appointment Details */}
                        {(order.deliveryAppointment || order.deliveryDate) && (
                          <View style={styles.appointmentSection}>
                            <Text style={styles.appointmentTitle}>Delivery Appointment Details</Text>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Date:</Text>
                              <Text style={styles.infoValue}>
                                {order.deliveryAppointment?.date 
                                  ? formatDateOnly(order.deliveryAppointment.date)
                                  : order.deliveryDate 
                                  ? formatDateOnly(order.deliveryDate)
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Time:</Text>
                              <Text style={styles.infoValue}>
                                {order.deliveryAppointment?.time 
                                  ? order.deliveryAppointment.time
                                  : order.deliveryDate 
                                  ? formatTime(order.deliveryDate)
                                  : 'N/A'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {order.status && (
                          <View style={styles.orderStatusRow}>
                            <Text style={styles.orderStatusLabel}>Status: </Text>
                            <Text style={[styles.orderStatusValue, {
                              color: order.status === 'in-delivery' ? '#3498db' :
                                     order.status === 'completed' ? '#2ecc71' :
                                     '#95a5a6'
                            }]}>
                              {order.status}
                            </Text>
            </View>
                        )}
              </View>
                    ))}
            </View>
                )}

                {trip.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
                    <Text style={styles.notesText}>{trip.notes}</Text>
          </View>
        )}

                {/* Documents */}
                {trip.documents && trip.documents.length > 0 && (
                  <View style={styles.documentsSection}>
                    <Text style={styles.documentsTitle}>
                      Documents ({trip.documents.length}):
                    </Text>
                    {trip.documents.map((doc, index) => (
                      <TouchableOpacity
                        key={doc._id || index}
                        style={styles.documentItem}
                        onPress={async () => {
                          if (!doc._id || !trip._id) {
                            Alert.alert('Error', 'Document information is missing.');
                            return;
                          }

                          try {
                            // Fetch signed URL before opening
                            const response = await apiService.getTripDocumentSignedUrl(trip._id, doc._id, 'inline');
                            if (response?.success && response?.data?.url) {
                              await Linking.openURL(response.data.url);
                            } else {
                              // Fallback to original URL
                              if (doc.fileUrl) {
                                await Linking.openURL(doc.fileUrl);
                              } else {
                                Alert.alert('Error', 'Unable to get document URL.');
                              }
                            }
                          } catch (error: any) {
                            console.error('Error opening document:', error);
                            // Fallback to original URL
                            if (doc.fileUrl) {
                              Linking.openURL(doc.fileUrl).catch(() => {
                                Alert.alert('Error', 'Unable to open document. Please try again.');
                              });
                            } else {
                              Alert.alert('Error', 'Unable to open document. Please try again.');
                            }
                          }
                        }}
                      >
                        <Ionicons name="document-text" size={ri(20)} color={COLORS.accentBlue} />
                        <View style={styles.documentInfo}>
                          <Text style={styles.documentName} numberOfLines={1}>
                            {doc.fileName}
                          </Text>
                          {doc.description && (
                            <Text style={styles.documentDescription} numberOfLines={1}>
                              {doc.description}
                            </Text>
                          )}
                          <Text style={styles.documentMeta}>
                            {doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown size'}
                            {doc.uploadedAt && ` • ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                          </Text>
                        </View>
                        <Ionicons name="download-outline" size={ri(20)} color={COLORS.accentBlue} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

        <View style={styles.buttonContainer}>
          {hasMap && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => {
                setSelectedTripForMap(trip);
                setMapModalVisible(true);
              }}
            >
              <Text style={styles.mapButtonText} numberOfLines={1}>View Map</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'pending_completion' || trip.status === 'pending-completion' ? (
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: '#f59e0b', opacity: 0.7 }]}
              disabled={true}
            >
              <Text style={styles.completeButtonText} numberOfLines={1}>Pending Approval</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleCompleteTrip(trip._id)}
            >
              <Text style={styles.completeButtonText} numberOfLines={1}>Complete Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
          })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Trip Completion Modal */}
      <Modal
        visible={completionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCompletionModalVisible(false);
          setSelectedTripForCompletion(null);
          setSelectedPodFile(null);
          setSelectedManifestFile(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.completionModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Trip</Text>
              <TouchableOpacity
                onPress={() => {
                  setCompletionModalVisible(false);
                  setSelectedTripForCompletion(null);
                  setSelectedPodFile(null);
                  setSelectedManifestFile(null);
                }}
              >
                <Ionicons name="close" size={ri(24)} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedTripForCompletion && (
              <ScrollView style={styles.modalScrollView}>
                <Text style={styles.modalSubtitle}>
                  Trip: {selectedTripForCompletion.tripNumber}
                </Text>
                <Text style={styles.modalDescription}>
                  Please upload required documents before completing the trip. The dispatcher will review your documents before final approval.
                </Text>

                {/* Document Upload Section - Works with Orders */}
                {(() => {
                  const trip = selectedTripForCompletion;
                  
                  // Get the first order (or modify to handle multiple orders)
                  const order = trip.orders && trip.orders.length > 0 ? trip.orders[0] : null;
                  if (!order) {
                    return <Text style={styles.errorText}>No order found for this trip</Text>;
                  }
                  
                  // Check if Canada trip
                  let isCanadaTrip = false;
                  const deliveryLocation = order.deliveryLocation;
                  if (deliveryLocation?.placeId?.country) {
                    const country = deliveryLocation.placeId.country.toLowerCase();
                    isCanadaTrip = country === 'canada' || country === 'ca';
                  } else if (deliveryLocation?.place) {
                    const placeStr = deliveryLocation.place.toLowerCase();
                    isCanadaTrip = placeStr.includes('canada') || placeStr.includes('ca ');
                  }
                  
                  // Check existing attachments from order
                  const attachments = order.attachments || [];
                  const hasPOD = attachments.some((att: any) => 
                    att.type === 'pod' || att.type === 'proof_of_delivery'
                  );
                  const hasManifest = attachments.some((att: any) => 
                    att.type === 'border_manifest' || att.type === 'manifest'
                  );

                  console.log('📋 Modal - Order Attachments:', attachments);
                  console.log('✅ Has POD:', hasPOD, 'Has Manifest:', hasManifest);

                  return (
                    <>
                      {/* POD Document Selection */}
                      <View style={styles.documentUploadSection}>
                        <View style={styles.documentHeader}>
                          <Text style={styles.documentTitle}>
                            📄 Proof of Delivery (POD) *
                          </Text>
                          {hasPOD && (
                            <View style={[styles.statusBadge, { backgroundColor: '#d4edda' }]}>
                              <Ionicons name="checkmark-circle" size={ri(16)} color={COLORS.statusSuccess} />
                              <Text style={[styles.statusText, { color: '#155724' }]}>Uploaded</Text>
                            </View>
                          )}
                        </View>
                        {!hasPOD ? (
                          <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={async () => {
                              if (!DocumentPicker) {
                                Alert.alert('Error', 'Document picker not available');
                                return;
                              }
                              try {
                                const result = await DocumentPicker.getDocumentAsync({
                                  type: ['application/pdf', 'image/*'],
                                  copyToCacheDirectory: true,
                                });
                                if (result.canceled === false && result.assets && result.assets.length > 0) {
                                  const file = result.assets[0];
                                  setSelectedPodFile(file);
                                  console.log('📄 POD file selected:', file.name);
                                }
                              } catch (error) {
                                console.error('Error selecting POD file:', error);
                                Alert.alert('Error', 'Failed to select file');
                              }
                            }}
                            disabled={uploadingDocument}
                          >
                            <Ionicons name="cloud-upload-outline" size={ri(20)} color={COLORS.accentBlue} />
                            <Text style={styles.uploadButtonText}>
                              {selectedPodFile ? `Selected: ${selectedPodFile.name}` : 'Select POD File'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.uploadedDocumentList}>
                            {attachments
                              .filter((att: any) => att.type === 'pod' || att.type === 'proof_of_delivery')
                              .map((att: any, index: number) => (
                                <View key={att.id || index} style={styles.uploadedDocumentItem}>
                                  <Ionicons name="document-text" size={ri(20)} color={COLORS.statusSuccess} />
                                  <Text style={styles.uploadedDocumentName}>{att.name}</Text>
                                </View>
                              ))}
                          </View>
                        )}
                      </View>

                      {/* Border Manifest Document Selection */}
                      <View style={styles.documentUploadSection}>
                        <View style={styles.documentHeader}>
                          <Text style={styles.documentTitle}>
                            📋 Border Manifest *
                          </Text>
                          {hasManifest && (
                            <View style={[styles.statusBadge, { backgroundColor: '#d4edda' }]}>
                              <Ionicons name="checkmark-circle" size={ri(16)} color={COLORS.statusSuccess} />
                              <Text style={[styles.statusText, { color: '#155724' }]}>Uploaded</Text>
                            </View>
                          )}
                        </View>
                        {!hasManifest ? (
                          <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={async () => {
                              if (!DocumentPicker) {
                                Alert.alert('Error', 'Document picker not available');
                                return;
                              }
                              try {
                                const result = await DocumentPicker.getDocumentAsync({
                                  type: ['application/pdf', 'image/*'],
                                  copyToCacheDirectory: true,
                                });
                                if (result.canceled === false && result.assets && result.assets.length > 0) {
                                  const file = result.assets[0];
                                  setSelectedManifestFile(file);
                                  console.log('📋 Manifest file selected:', file.name);
                                }
                              } catch (error) {
                                console.error('Error selecting manifest file:', error);
                                Alert.alert('Error', 'Failed to select file');
                              }
                            }}
                            disabled={uploadingDocument}
                          >
                            <Ionicons name="cloud-upload-outline" size={ri(20)} color={COLORS.accentBlue} />
                            <Text style={styles.uploadButtonText}>
                              {selectedManifestFile ? `Selected: ${selectedManifestFile.name}` : 'Select Manifest File'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.uploadedDocumentList}>
                            {attachments
                              .filter((att: any) => att.type === 'border_manifest' || att.type === 'manifest')
                              .map((att: any, index: number) => (
                                <View key={att.id || index} style={styles.uploadedDocumentItem}>
                                  <Ionicons name="document-text" size={ri(20)} color={COLORS.statusSuccess} />
                                  <Text style={styles.uploadedDocumentName}>{att.name}</Text>
                                </View>
                              ))}
                          </View>
                        )}
                      </View>

                      {/* Submit for Review Button */}
                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          ((!hasPOD && !selectedPodFile) || (!hasManifest && !selectedManifestFile)) && styles.submitButtonDisabled
                        ]}
                        onPress={async () => {
                          console.log('🔄 Submit for Review clicked');
                          console.log('📄 POD File:', selectedPodFile ? 'Selected' : 'Not selected');
                          console.log('📋 Manifest File:', selectedManifestFile ? 'Selected' : 'Not selected');
                          await handleSubmitCompletion();
                        }}
                        disabled={(!hasPOD && !selectedPodFile) || (!hasManifest && !selectedManifestFile) || uploadingDocument}
                      >
                        {uploadingDocument ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.submitButtonText}>Submit for Review</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Map Modal */}
      {selectedTripForMap && (() => {
        const loadForMap = convertTripToLoadForMap(selectedTripForMap);
        if (!loadForMap) return null;
        
        return (
        <MapViewWithLiveTracking
          visible={mapModalVisible}
          onClose={() => {
            setMapModalVisible(false);
              setSelectedTripForMap(null);
          }}
            load={loadForMap}
        />
        );
      })()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({

  // ── Layout ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  scrollView: {
    flex: 1,
  },

  // ── Loading ─────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SP.sm,
    color: COLORS.textSecondary,
    fontSize: FS.sm,
  },

  // ── Header (compact row) ────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: SP.base,
    paddingVertical: SP.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    overflow: 'hidden',
  },
  headerGlowLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: FS.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginTop: rs(1),
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },
  statItem: {
    alignItems: 'center',
    minWidth: rs(44),
  },
  statNumber: {
    fontSize: FS.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentBlue,
  },
  statLabel: {
    fontSize: rf(9),
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    height: rs(28),
    backgroundColor: COLORS.borderSubtle,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP['2xl'],
  },
  emptyIcon: {
    fontSize: rf(56),
    marginBottom: SP.base,
  },
  emptyText: {
    fontSize: FS.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SP.sm,
  },
  emptySubtext: {
    fontSize: FS.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── Section container / header ───────────────────────────────────────────────
  sectionContainer: {
    marginBottom: SP.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.base,
    paddingVertical: SP.sm,
    gap: SP.sm,
  },
  sectionTitle: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentNavyBlue,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
  },

  // ── Trip card ────────────────────────────────────────────────────────────────
  tripCard: {
    backgroundColor: COLORS.bgCard,
    marginHorizontal: SP.md,
    marginBottom: SP.md,
    padding: SP.base,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.15,
    shadowRadius: rs(4),
    elevation: 3,
  },
  pendingCard: {
    borderLeftWidth: rs(3),
    borderLeftColor: COLORS.accentOrange,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SP.md,
  },
  headerInfo: {
    flex: 1,
  },
  tripNumber: {
    fontSize: FS.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentBlue,
    marginBottom: rs(2),
  },
  tripDate: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    paddingHorizontal: SP.sm + 2,
    paddingVertical: rs(4),
    borderRadius: RADIUS.full,
  },
  statusText: {
    color: COLORS.white,
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // ── Info rows ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    marginBottom: SP.xs + 2,
  },
  infoLabel: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    width: rs(76),
  },
  infoValue: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: SP.xs,
  },
  locationLabel: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  locationValue: {
    fontSize: FS.xs,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // ── Orders section ───────────────────────────────────────────────────────────
  ordersSection: {
    marginTop: SP.md,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  ordersTitle: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SP.sm,
  },
  orderItem: {
    backgroundColor: COLORS.bgCardLight,
    padding: SP.md,
    borderRadius: RD.md,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  orderNumber: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: rs(4),
  },
  customerOrderNo: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: rs(2),
  },
  customerName: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: rs(4),
  },
  orderStatusRow: {
    flexDirection: 'row',
    marginTop: SP.xs,
  },
  orderStatusLabel: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  orderStatusValue: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // ── Inner section divider (Shipper / Receiver) ───────────────────────────────
  sectionDivider: {
    marginTop: SP.md,
    marginBottom: SP.sm,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },

  // ── Appointment block ────────────────────────────────────────────────────────
  appointmentSection: {
    backgroundColor: 'rgba(0,209,255,0.05)',
    padding: SP.sm + 2,
    borderRadius: RD.sm,
    marginTop: SP.sm,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  appointmentTitle: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: SP.xs,
  },

  // ── Stops ────────────────────────────────────────────────────────────────────
  stopsSection: {
    marginTop: SP.md,
    padding: SP.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RD.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  stopsTitle: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SP.sm,
  },
  stopItem: {
    marginBottom: SP.md,
    padding: SP.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RD.sm,
    borderLeftWidth: rs(2),
    borderLeftColor: COLORS.accentBlue,
  },
  stopNumber: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: SP.xs,
  },

  // ── Notes ────────────────────────────────────────────────────────────────────
  notesSection: {
    marginTop: SP.md,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  notesLabel: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SP.xs,
  },
  notesText: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
  },

  // ── Pending note ─────────────────────────────────────────────────────────────
  pendingNote: {
    fontSize: FS.xs,
    color: COLORS.accentOrange,
    marginTop: SP.sm,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xs + 2,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: RD.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },

  // ── Documents ────────────────────────────────────────────────────────────────
  documentsSection: {
    marginTop: SP.md,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  documentsTitle: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SP.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardLight,
    padding: SP.md,
    borderRadius: RD.md,
    marginBottom: SP.sm,
    gap: SP.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentName: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: rs(2),
  },
  documentDescription: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: rs(2),
  },
  documentMeta: {
    fontSize: rf(10),
    color: COLORS.textSecondary,
  },

  // ── Action buttons ────────────────────────────────────────────────────────────
  buttonContainer: {
    flexDirection: 'row',
    gap: SP.sm,
    marginTop: SP.md,
  },
  chatButton: {
    flex: 1,
    backgroundColor: COLORS.accentBlue,
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.sm,
    borderRadius: RD.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(4),
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.3,
    shadowRadius: rs(4),
    elevation: 3,
    minHeight: rs(40),
  },
  chatButtonText: {
    color: COLORS.black,
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    flexShrink: 1,
  },
  mapButton: {
    flex: 1,
    backgroundColor: 'rgba(0,209,255,0.12)',
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.sm,
    borderRadius: RD.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    minHeight: rs(40),
  },
  mapButtonText: {
    color: COLORS.accentBlue,
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.accentGreen,
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.sm,
    borderRadius: RD.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: rs(6),
    elevation: 3,
    minHeight: rs(40),
  },
  completeButtonText: {
    color: COLORS.black,
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },

  // ── Completion modal ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  completionModalContent: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RD['2xl'],
    borderTopRightRadius: RD['2xl'],
    maxHeight: '90%',
    paddingBottom: SP.xl,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SP.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  modalTitle: {
    fontSize: FS.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  modalScrollView: {
    padding: SP.base,
  },
  modalSubtitle: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: SP.sm,
  },
  modalDescription: {
    fontSize: FS.sm,
    color: COLORS.textSecondary,
    marginBottom: SP.base,
    lineHeight: rf(20),
  },

  // ── Upload sections ───────────────────────────────────────────────────────────
  documentUploadSection: {
    marginBottom: SP.base,
    padding: SP.base,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SP.md,
  },
  documentTitle: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  requiredText: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentRed,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SP.sm,
    backgroundColor: 'rgba(0,209,255,0.06)',
    padding: SP.md,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
  },
  selectedFileContainer: {
    marginTop: SP.md,
    padding: SP.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  selectedFileName: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
    marginBottom: SP.sm,
  },
  uploadSubmitButton: {
    backgroundColor: COLORS.accentBlue,
    padding: SP.sm + 2,
    borderRadius: RD.md,
    alignItems: 'center',
  },
  uploadSubmitText: {
    color: COLORS.black,
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FS.sm,
  },
  uploadedDocumentList: {
    marginTop: SP.md,
  },
  uploadedDocumentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    padding: SP.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RD.md,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  uploadedDocumentName: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },
  allDocumentsSection: {
    marginTop: SP.base,
    marginBottom: SP.base,
  },
  allDocumentsTitle: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SP.md,
  },
  documentType: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginTop: SP.xs,
  },
  submitButton: {
    backgroundColor: COLORS.accentGreen,
    padding: SP.base,
    borderRadius: RD.lg,
    alignItems: 'center',
    marginTop: SP.base,
    shadowColor: COLORS.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: rs(8),
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.statusNeutral,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.black,
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default ActiveTrips;
