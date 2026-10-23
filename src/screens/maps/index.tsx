import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MapViewWithLiveTracking from '../../components/MapViewWithLiveTracking';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';
// Import Trip interface and conversion function from ActiveTrips
interface Trip {
  _id: string;
  tripNumber: string;
  status: string;
  truck?: {
    _id: string;
    plateNumber?: string;
    internalId?: string;
    make?: string;
    model?: string;
    trackingKey?: string;
    yard?: {
      yardName?: string;
      yardCode?: string;
      address?: string;
      city?: string;
      stateProvince?: string;
      coordinates?: {
        latitude: number | null;
        longitude: number | null;
      };
    };
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
      placeId?: {
        name?: string;
        currentLocation?: {
          address?: string;
        };
      };
      latitude?: string;
      longitude?: string;
    };
    deliveryLocation?: {
      place?: string;
      placeId?: {
        name?: string;
        currentLocation?: {
          address?: string;
        };
      };
      latitude?: string;
      longitude?: string;
    };
    shipper?: {
      name?: string;
      address?: string;
      city?: string;
      province?: string;
    };
    receiver?: {
      name?: string;
      address?: string;
    };
    stops?: Array<{
      stop?: number;
      shipper?: string;
      address?: string;
      latitude?: string;
      longitude?: string;
      pickup?: boolean;
    }>;
    receiverStops?: Array<{
      stop?: number;
      receiver?: string;
      address?: string;
      latitude?: string;
      longitude?: string;
      dropOff?: boolean;
    }>;
    commodity?: string;
    weight?: number;
    weightUnit?: string;
  }>;
  yardLocation?: {
    yardName?: string;
    yardCode?: string;
    address?: string;
    city?: string;
    stateProvince?: string;
    coordinates?: {
      latitude: number | null;
      longitude: number | null;
    };
  };
}

interface LoadWaypoint {
  address?: {
    place?: string;
    city?: string;
    state?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
  dropOff?: boolean;
  pickup?: boolean;
}

interface LoadLocation {
  place?: string;
  city?: string;
  state?: string;
  latitude?: number | string;
  longitude?: number | string;
}

interface Load {
  _id: string;
  internalId?: string;
  orderType?: string;
  status: string;
  route?: {
    multipleDropOffs?: boolean;
    selectPickup?: LoadLocation;
    selectDropOff?: LoadLocation;
    wayPoints?: LoadWaypoint[];
  };
  vehicle?: {
    _id: string;
    internalId: string;
    plateNumber?: string;
    make?: string;
    model?: string;
    trackingKey?: string;
  };
  customer?: {
    name?: string;
    email?: string;
  };
  payloads?: Array<{
    itemName?: string;
    description?: string;
    measurementAndWeight?: {
      weight?: number;
    };
  }>;
  yardLocation?: {
    yardName?: string;
    yardCode?: string;
    address?: string;
    city?: string;
    stateProvince?: string;
    coordinates?: {
      latitude: number | null;
      longitude: number | null;
    };
  };
  eta?: string;
  updatedAt?: string;
  notes?: string;
}

const parseCoordinate = (value: number | string | undefined | null): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Helper function to extract waypoint coordinates (tries multiple formats)
const getWaypointCoordinates = (waypoint: LoadWaypoint): { lat: number | null; lng: number | null } => {
  // Try multiple ways to get coordinates
  let lat = parseCoordinate(waypoint.address?.latitude);
  let lng = parseCoordinate(waypoint.address?.longitude);

  // If not found in address, try direct on waypoint
  if (lat === null || lng === null) {
    lat = parseCoordinate((waypoint as any)?.latitude);
    lng = parseCoordinate((waypoint as any)?.longitude);
  }

  // If still not found, try coordinates array
  if ((lat === null || lng === null) && (waypoint.address as any)?.coordinates) {
    const coords = (waypoint.address as any).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = parseCoordinate(coords[0]); // longitude first in GeoJSON
      lat = parseCoordinate(coords[1]); // latitude second in GeoJSON
    }
  }

  return { lat, lng };
};

const hasValidCoordinates = (load: Load): boolean => {
  let pickup = load.route?.selectPickup;
  const dropoff = load.route?.selectDropOff;
  const multipleDropOffs = load.route?.multipleDropOffs || false;
  const wayPoints = load.route?.wayPoints || [];

  // For multiple dropoffs, pickup might be in wayPoints instead of selectPickup
  if (!pickup && multipleDropOffs && wayPoints.length > 0) {
    const pickupWaypoint = wayPoints.find(wp => wp.pickup === true);
    if (pickupWaypoint && pickupWaypoint.address) {
      pickup = pickupWaypoint.address;
    }
  }

  const pickupLat = parseCoordinate(pickup?.latitude);
  const pickupLng = parseCoordinate(pickup?.longitude);

  // Must have pickup coordinates
  if (pickupLat === null || pickupLng === null) {
    return false;
  }

  // For multiple dropoffs, check if we have at least one waypoint with valid coordinates
  if (multipleDropOffs) {
    if (wayPoints.length === 0) {
      return false;
    }
    // Check if at least one waypoint has valid coordinates
    return wayPoints.some(wp => {
      const { lat, lng } = getWaypointCoordinates(wp);
      return lat !== null && lng !== null;
    });
  } else {
    // For single dropoff, check dropoff coordinates
    const dropLat = parseCoordinate(dropoff?.latitude);
    const dropLng = parseCoordinate(dropoff?.longitude);
    return dropLat !== null && dropLng !== null;
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'in-delivery':
    case 'in transit':
    case 'started':
      return '#2563eb';
    case 'assigned':
    case 'pending':
      return '#f59e0b';
    case 'completed':
    case 'delivered':
      return '#16a34a';
    case 'cancelled':
      return '#dc2626';
    default:
      return '#4b5563';
  }
};

// Helper function to convert Trip (which contains orders) to Load format for map
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

  // Get first order for main pickup and last order for main delivery
  const firstOrder = trip.orders[0];
  const lastOrder = trip.orders[trip.orders.length - 1];
  const pickup = firstOrder.pickupLocation;
  const dropoff = lastOrder.deliveryLocation;
  const pickupCoords = getLocationCoords(pickup);
  const dropoffCoords = getLocationCoords(dropoff);

  // Build waypoints from all orders including stops
  const wayPoints: Array<{
    address: {
      place: string;
      latitude: number | string | null;
      longitude: number | string | null;
    };
    pickup?: boolean;
    dropOff?: boolean;
    stopNumber?: number;
    stopType?: 'main' | 'additional';
  }> = [];

  // Helper to get stop coordinates
  const getStopCoords = (stop: any, order: any) => {
    if (!stop) return { lat: null, lng: null };

    const lat = parseCoord(stop.latitude || stop.lat);
    const lng = parseCoord(stop.longitude || stop.lng);
    if (lat !== null && lng !== null) return { lat, lng };

    // Fallback to main location
    if (stop.address && typeof stop.address === 'string') {
      if (order.pickupLocation) {
        const coords = getLocationCoords(order.pickupLocation);
        if (coords.lat !== null && coords.lng !== null) return coords;
      }
      if (order.deliveryLocation) {
        const coords = getLocationCoords(order.deliveryLocation);
        if (coords.lat !== null && coords.lng !== null) return coords;
      }
    }

    return { lat: null, lng: null };
  };

  // Collect all locations from orders
  trip.orders.forEach((order, orderIndex) => {
    // Main pickup
    const pickupCoords = getLocationCoords(order.pickupLocation);
    if (pickupCoords.lat !== null && pickupCoords.lng !== null) {
      wayPoints.push({
        address: {
          place: order.pickupLocation?.place || order.shipper?.address || `Pickup ${orderIndex + 1}`,
          latitude: pickupCoords.lat,
          longitude: pickupCoords.lng,
        },
        pickup: true,
        dropOff: false,
        stopType: 'main',
      });
    }

    // Additional pickup stops
    if (order.stops && Array.isArray(order.stops)) {
      order.stops.forEach((stop: any, stopIndex: number) => {
        const stopCoords = getStopCoords(stop, order);
        if (stopCoords.lat !== null && stopCoords.lng !== null) {
          wayPoints.push({
            address: {
              place: stop.address || stop.shipper || `Pickup Stop ${stop.stop || stopIndex + 1}`,
              latitude: stopCoords.lat,
              longitude: stopCoords.lng,
            },
            pickup: true,
            dropOff: false,
            stopNumber: stop.stop || stopIndex + 1,
            stopType: 'additional',
          });
        }
      });
    }

    // Main delivery
    const deliveryCoords = getLocationCoords(order.deliveryLocation);
    if (deliveryCoords.lat !== null && deliveryCoords.lng !== null) {
      wayPoints.push({
        address: {
          place: order.deliveryLocation?.place || order.receiver?.address || `Delivery ${orderIndex + 1}`,
          latitude: deliveryCoords.lat,
          longitude: deliveryCoords.lng,
        },
        pickup: false,
        dropOff: true,
        stopType: 'main',
      });
    }

    // Additional delivery stops
    if (order.receiverStops && Array.isArray(order.receiverStops)) {
      order.receiverStops.forEach((stop: any, stopIndex: number) => {
        const stopCoords = getStopCoords(stop, order);
        if (stopCoords.lat !== null && stopCoords.lng !== null) {
          wayPoints.push({
            address: {
              place: stop.address || stop.receiver || `Delivery Stop ${stop.stop || stopIndex + 1}`,
              latitude: stopCoords.lat,
              longitude: stopCoords.lng,
            },
            pickup: false,
            dropOff: true,
            stopNumber: stop.stop || stopIndex + 1,
            stopType: 'additional',
          });
        }
      });
    }
  });

  // Get yard location
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
      wayPoints: wayPoints.filter(wp => wp.address.latitude !== null && wp.address.longitude !== null).map(wp => ({
        address: {
          place: wp.address.place,
          latitude: wp.address.latitude !== null ? wp.address.latitude : undefined,
          longitude: wp.address.longitude !== null ? wp.address.longitude : undefined,
        },
        pickup: wp.pickup,
        dropOff: wp.dropOff,
        stopNumber: wp.stopNumber,
        stopType: wp.stopType,
      })),
    },
    vehicle: trip.truck ? {
      _id: trip.truck._id,
      internalId: trip.truck.internalId || trip.truck.plateNumber || '',
      plateNumber: trip.truck.plateNumber,
      trackingKey: (trip.truck as any).trackingKey,
    } : undefined,
    yardLocation: yardLocation,
  };
};

const LoadMapScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    fetchActiveTrips();
  }, []);

  const fetchActiveTrips = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const response = await apiService.getActiveTrips();

      if (response.success && response.data) {
        const tripsData = Array.isArray(response.data.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];

        setTrips(tripsData);

        // Convert trips to loads for map display
        const convertedLoads = tripsData
          .map(trip => convertTripToLoadForMap(trip))
          .filter((load): load is Load => load !== null);

        setLoads(convertedLoads);

        if (convertedLoads.length > 0) {
          setSelectedLoad((current) => current ?? convertedLoads[0]);
        } else {
          setSelectedLoad(null);
          setMapVisible(false);
        }

        logger.info('Active trips fetched for LoadMap', { count: tripsData.length, convertedLoads: convertedLoads.length });
      } else {
        logger.warn('Failed to fetch active trips for LoadMap', { error: response.error });
        setTrips([]);
        setLoads([]);
        setSelectedLoad(null);
        setMapVisible(false);
      }
    } catch (error) {
      logger.error('Error fetching active trips for LoadMap', error);
      setTrips([]);
      setLoads([]);
      setSelectedLoad(null);
      setMapVisible(false);
      Alert.alert('Error', 'Failed to load active trips. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveTrips();
  };

  const handleViewOnMap = (load: Load) => {
    if (!hasValidCoordinates(load)) {
      Alert.alert(
        'Missing Location Data',
        'This load does not include valid pickup and drop-off coordinates. Please contact your dispatcher.'
      );
      return;
    }

    setSelectedLoad(load);
    setMapVisible(true);
  };

  const activeLoadsCount = useMemo(() => loads.length, [loads]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Load Map</Text>
            <Text style={styles.headerSubtitle}>Track your active assignments on the map</Text>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{activeLoadsCount}</Text>
            <Text style={styles.counterLabel}>Active</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accentNavyBlue} />
            <Text style={styles.loadingText}>Loading active trips...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#8B5CF6']}
                tintColor="#8B5CF6"
              />
            }
          >
            {loads.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={64} color={COLORS.textPrimary} />
                <Text style={styles.emptyTitle}>No Active Trips</Text>
                <Text style={styles.emptySubtitle}>
                  You don't have any active trips assigned yet. Pull down to refresh.
                </Text>
              </View>
            ) : (
              loads.map((load) => {
                // Find the corresponding trip to get order information
                const trip = trips.find(t => t._id === load._id);
                const firstOrder = trip?.orders?.[0];
                const orderCount = trip?.orders?.length || 0;

                return (
                  <View key={load._id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.loadIdContainer}>
                        <Text style={styles.loadId}>{load.internalId || trip?.tripNumber || 'Unassigned ID'}</Text>
                        {orderCount > 1 && (
                          <View style={[styles.orderCountBadge]}>
                            <Text style={styles.orderCountText}>{orderCount} Orders</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(trip?.status || load.status || '') },
                          ]}
                        >
                          <Text style={styles.statusText}>{(trip?.status || load.status || 'UNKNOWN')?.toUpperCase()}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => handleViewOnMap(load)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="map" size={18} color="#fff" />
                        <Text style={styles.mapButtonText}>View on Map</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Show order numbers if multiple orders */}
                    {orderCount > 1 && trip?.orders && (
                      <View style={styles.ordersInfo}>
                        <Ionicons name="list-outline" size={14} color="#6B7280" />
                        <Text style={styles.ordersInfoText}>
                          {trip.orders.map(o => o.orderNumber).join(', ')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.routeRow}>
                      <View style={styles.routeMarker}>
                        <View style={[styles.markerDot, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.markerLabel}>Pickup</Text>
                      </View>
                      <View style={styles.routeDetails}>
                        <Text style={styles.routeLocation}>
                          {load.route?.selectPickup?.place || firstOrder?.shipper?.address || 'Location not provided'}
                        </Text>
                        <Text style={styles.routeAddress}>
                          {firstOrder?.shipper?.city || '-'}
                          {firstOrder?.shipper?.province ? `, ${firstOrder.shipper.province}` : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.routeConnector} />

                    <View style={styles.routeRow}>
                      <View style={styles.routeMarker}>
                        <View style={[styles.markerDot, { backgroundColor: '#EF4444' }]} />
                        <Text style={styles.markerLabel}>Drop-off</Text>
                      </View>
                      <View style={styles.routeDetails}>
                        <Text style={styles.routeLocation}>
                          {load.route?.selectDropOff?.place || firstOrder?.receiver?.address || 'Location not provided'}
                        </Text>
                        <Text style={styles.routeAddress}>
                          {firstOrder?.receiver?.address || '-'}
                        </Text>
                      </View>
                    </View>

                    {/* Show waypoints count if multiple stops */}
                    {load.route?.wayPoints && load.route.wayPoints.length > 2 && (
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={16} color={COLORS.accentNavyBlue} />
                        <Text style={styles.metaLabel}>Additional Stops</Text>
                        <Text style={styles.metaValue}>{load.route.wayPoints.length - 2} stops</Text>
                      </View>
                    )}

                    {load.vehicle?.internalId && (
                      <View style={styles.metaRow}>
                        <Ionicons name="car-outline" size={16} color={COLORS.accentRed} />
                        <Text style={styles.metaLabel}>Vehicle</Text>
                        <Text style={styles.metaValue}>{load.vehicle.internalId}</Text>
                      </View>
                    )}

                    {firstOrder?.customer?.name && (
                      <View style={styles.metaRow}>
                        <Ionicons name="business-outline" size={16} color={COLORS.accentGreen} />
                        <Text style={styles.metaLabel}>Customer</Text>
                        <Text style={styles.metaValue}>{firstOrder.customer.name}</Text>
                      </View>
                    )}

                    {firstOrder?.commodity && (
                      <View style={styles.metaRow}>
                        <Ionicons name="cube-outline" size={16} color="#4B5563" />
                        <Text style={styles.metaLabel}>Commodity</Text>
                        <Text style={styles.metaValue}>
                          {firstOrder.commodity}
                          {firstOrder.weight ? ` • ${firstOrder.weight} ${firstOrder.weightUnit || 'kg'}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {selectedLoad && (
        <MapViewWithLiveTracking
          visible={mapVisible}
          onClose={() => setMapVisible(false)}
          load={selectedLoad}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  counterBadge: {
    backgroundColor: COLORS.accentNavyBlue,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  counterText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  counterLabel: {
    color: '#ede9fe',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  loadIdContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
    marginRight: 8,
  },
  loadId: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mapButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    flexShrink: 0,
    minWidth: 100,
  },
  mapButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    flexShrink: 1,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeMarker: {
    width: 70,
    alignItems: 'center',
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeDetails: {
    flex: 1,
    // borderBottomWidth: 1,
    // borderBottomColor: COLORS.accentNavyBlue,
    paddingBottom: 12,
  },
  routeLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  routeConnector: {
    height: 20,
    marginLeft: 70,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  metaValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  ordersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  ordersInfoText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  orderCountBadge: {
    backgroundColor: COLORS.accentGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  orderCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
});

export default LoadMapScreen;