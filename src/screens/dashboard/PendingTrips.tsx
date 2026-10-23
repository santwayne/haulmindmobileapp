import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, rs, rf, ri } from '../../theme';

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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PendingTripsRouteProp = RouteProp<RootStackParamList, 'PendingTrips'>;

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
      placeId?: {
        name?: string;
        currentLocation?: {
          address?: string;
        };
      };
    };
    deliveryLocation?: {
      place?: string;
      placeId?: {
        name?: string;
        currentLocation?: {
          address?: string;
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
    attachments?: Array<{
      id?: number;
      name: string;
      url: string;
      fileSize?: number;
      payable?: boolean;
      shareWithDriver?: boolean;
      uploadedAt?: string;
      uploadedBy?: any;
    }>;
  }>;
  plannedStartDate?: string;
  plannedEndDate?: string;
  notes?: string;
  driverAcceptanceStatus?: 'pending' | 'accepted' | 'rejected';
  driverRejectionReason?: string;
  documents?: Array<{
    _id?: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy?: any;
    uploadedAt?: string;
    description?: string;
  }>;
}

// ─── Tab type ────────────────────────────────────────────────────────────────
type TabType = 'requests' | 'accepted';

const PendingTrips = () => {
  const route = useRoute<PendingTripsRouteProp>();
  const lockedTab = route.params?.initialTab ?? null; // non-null = single-tab mode
  const [assignmentRequests, setAssignmentRequests] = useState<Trip[]>([]);
  const [acceptedTrips, setAcceptedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(lockedTab || 'requests');
  const navigation = useNavigation<NavigationProp>();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [requestsRes, pendingRes] = await Promise.all([
        apiService.getAssignmentRequests(),
        apiService.getPendingTrips(),
      ]);

      if (requestsRes?.success) {
        const rawData = requestsRes.data?.data ?? requestsRes.data;
        const raw: any[] = Array.isArray(rawData) ? rawData : [];
        // Normalize standalone-order items so the card renderer works for both
        // Trip items and Order items. Order items have their details at the top
        // level; wrap them in orders:[self] so the existing renderer can show them.
        const normalized = (Array.isArray(raw) ? raw : []).map((item: any) => {
          if (item._isOrder) {
            return {
              ...item,
              orders: [item], // wrap self so order details render like a trip's orders
            };
          }
          return item;
        });
        setAssignmentRequests(normalized);
      } else {
        setAssignmentRequests([]);
      }

      if (pendingRes?.success) {
        const data = pendingRes.data?.data || pendingRes.data || [];
        setAcceptedTrips(Array.isArray(data) ? data : []);
      } else {
        setAcceptedTrips([]);
      }
    } catch (error) {
      console.error("❌ Error fetching trips:", error);
      setAssignmentRequests([]);
      setAcceptedTrips([]);
      Alert.alert('Error', 'Failed to load trips. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch every time the screen comes into focus, and re-sync the active tab
  // from route params (needed because React Navigation caches the screen instance)
  useFocusEffect(
    useCallback(() => {
      const tab = route.params?.initialTab ?? null;
      setActiveTab(tab || 'requests');
      fetchAll();
    }, [fetchAll, route.params?.initialTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleStartTrip = async (tripId: string) => {
    Alert.alert(
      'Start Trip',
      'Are you sure you want to start this trip? This will change all order statuses to in-delivery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            try {
              const response = await apiService.startTrip(tripId);
              if (response.success) {
                Alert.alert('Success', 'Trip started successfully');
                fetchAll();
              } else {
                Alert.alert('Error', response.error || response.message || 'Failed to start trip');
              }
            } catch (error) {
              logger.error('Error starting trip', error);
              Alert.alert('Error', 'Failed to start trip. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleAccept = async (item: Trip) => {
    Alert.alert(
      'Accept Assignment',
      `Accept ${(item as any)._isOrder ? 'order' : 'trip'} ${item.tripNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            try {
              const response = (item as any)._isOrder
                ? await apiService.acceptOrder(item._id)
                : await apiService.acceptTrip(item._id);
              if (response.success) {
                setAssignmentRequests(prev => prev.filter(t => t._id !== item._id));
                setAcceptedTrips(prev => [{ ...item, driverAcceptanceStatus: 'accepted' }, ...prev]);
                setActiveTab('accepted');
                Alert.alert('Accepted', 'You have accepted this assignment. The dispatcher has been notified.');
              } else {
                Alert.alert('Error', response.error || response.message || 'Failed to accept');
              }
            } catch (error) {
              logger.error('Error accepting assignment', error);
              Alert.alert('Error', 'Failed to accept. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReject = (item: Trip) => {
    Alert.prompt(
      'Reject Assignment',
      'Please provide a reason (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            try {
              const response = (item as any)._isOrder
                ? await apiService.rejectOrder(item._id, reason)
                : await apiService.rejectTrip(item._id, reason);
              if (response.success) {
                setAssignmentRequests(prev => prev.filter(t => t._id !== item._id));
                Alert.alert(
                  'Rejected',
                  'You have rejected this assignment. The dispatcher has been notified and will assign another driver.'
                );
              } else {
                Alert.alert('Error', response.error || response.message || 'Failed to reject');
              }
            } catch (error) {
              logger.error('Error rejecting assignment', error);
              Alert.alert('Error', 'Failed to reject. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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

  const getStatusDisplay = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'planned': return 'Planned';
      case 'dispatched': return 'Dispatched';
      default: return status || 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "dispatched": return COLORS.accentBlue;
      case "planned": return COLORS.accentOrange;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "dispatched": return 'rgba(0,209,255,0.12)';
      case "planned": return 'rgba(245,158,11,0.12)';
      default: return 'rgba(139,155,180,0.12)';
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
          <Text style={styles.loadingText}>Loading trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayedTrips = activeTab === 'requests' ? assignmentRequests : acceptedTrips;


  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Tab Bar — hidden when opened from dashboard with a locked tab */}
      {!lockedTab && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Ionicons
              name="notifications-outline"
              size={ri(16)}
              color={activeTab === 'requests' ? COLORS.accentBlue : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Assignment Requests
            </Text>
            {assignmentRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{assignmentRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'accepted' && styles.tabActive]}
            onPress={() => setActiveTab('accepted')}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={ri(16)}
              color={activeTab === 'accepted' ? COLORS.accentBlue : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
              Accepted Trips
            </Text>
            {acceptedTrips.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: COLORS.statusSuccess }]}>
                <Text style={styles.tabBadgeText}>{acceptedTrips.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'requests' && assignmentRequests.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={ri(48)} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No pending requests</Text>
            <Text style={styles.emptySubtext}>New trip assignments will appear here.</Text>
          </View>
        )}
        {activeTab === 'accepted' && acceptedTrips.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={ri(48)} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No accepted trips</Text>
            <Text style={styles.emptySubtext}>Accept an assignment to see it here.</Text>
          </View>
        )}
        {displayedTrips.map((trip) => (
          <View key={trip._id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View>
                <Text style={styles.tripNumber}>{trip.tripNumber}</Text>
                <Text style={styles.tripDate}>
                  Start: {formatDate(trip.plannedStartDate)}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                {
                  backgroundColor: activeTab === 'accepted'
                    ? 'rgba(0,255,163,0.12)'
                    : getStatusBgColor(trip.status),
                  borderColor: activeTab === 'accepted'
                    ? COLORS.accentGreen
                    : getStatusColor(trip.status),
                },
              ]}>
                <Text style={[
                  styles.statusText,
                  {
                    color: activeTab === 'accepted'
                      ? COLORS.accentGreen
                      : getStatusColor(trip.status),
                  },
                ]}>
                  {activeTab === 'accepted' ? 'Accepted' : getStatusDisplay(trip.status)}
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

                    {/* Documents from Order - Only show if shareWithDriver is true */}
                    {order.attachments && order.attachments.length > 0 && (() => {
                      const sharedDocuments = order.attachments.filter((att: any) => att.shareWithDriver === true);
                      if (sharedDocuments.length === 0) return null;

                      return (
                        <View style={styles.documentsSection}>
                          <Text style={styles.documentsTitle}>
                            Documents ({sharedDocuments.length}):
                          </Text>
                          {sharedDocuments.map((doc: any, docIndex: number) => (
                            <TouchableOpacity
                              key={doc.id || docIndex}
                              style={styles.documentItem}
                              onPress={async () => {
                                if (!doc.id || !order._id) {
                                  Alert.alert('Error', 'Document information is missing.');
                                  return;
                                }

                                try {
                                  // Fetch signed URL before opening
                                  const response = await apiService.getOrderAttachmentSignedUrl(order._id, doc.id.toString(), 'inline');
                                  if (response?.success && response?.data?.url) {
                                    await Linking.openURL(response.data.url);
                                  } else {
                                    // Fallback to original URL
                                    if (doc.url) {
                                      await Linking.openURL(doc.url);
                                    } else {
                                      Alert.alert('Error', 'Unable to get document URL.');
                                    }
                                  }
                                } catch (error: any) {
                                  console.error('Error opening document:', error);
                                  // Fallback to original URL
                                  if (doc.url) {
                                    Linking.openURL(doc.url).catch(() => {
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
                                  {doc.name || 'Document'}
                                </Text>
                                <Text style={styles.documentMeta}>
                                  {doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown size'}
                                  {doc.uploadedAt && ` • ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                                </Text>
                              </View>
                              <Ionicons name="download-outline" size={ri(20)} color={COLORS.accentBlue} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })()}
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

            {/* Action area — depends on active tab */}
            {activeTab === 'requests' ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAccept(trip)}
                >
                  <Ionicons name="checkmark-circle-outline" size={ri(18)} color={COLORS.white} />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(trip)}
                >
                  <Ionicons name="close-circle-outline" size={ri(18)} color={COLORS.white} />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.acceptedBanner}>
                  <Ionicons name="checkmark-circle" size={ri(16)} color={COLORS.accentGreen} />
                  <Text style={styles.acceptedBannerText}>You accepted this trip</Text>
                </View>
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => handleStartTrip(trip._id)}
                >
                  <Text style={styles.startButtonText}>Start Trip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  // ─── Tab Bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SP.md,
    gap: SP.xs + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.accentBlue,
  },
  tabText: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.accentBlue,
    fontWeight: FONT_WEIGHT.semibold,
  },
  tabBadge: {
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
    minWidth: rs(18),
    height: rs(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(4),
  },
  tabBadgeText: {
    color: COLORS.white,
    fontSize: rf(9),
    fontWeight: FONT_WEIGHT.bold,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SP.md,
    fontSize: FS.base,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SP['3xl'],
    marginTop: rs(80),
  },
  emptyText: {
    fontSize: FS.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SP.sm,
  },
  emptySubtext: {
    fontSize: FS.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tripCard: {
    backgroundColor: COLORS.bgCard,
    margin: SP.md,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.15,
    shadowRadius: rs(6),
    elevation: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SP.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  tripNumber: {
    fontSize: FS.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentBlue,
    marginBottom: rs(3),
  },
  tripDate: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    paddingHorizontal: SP.md,
    paddingVertical: rs(5),
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: SP.xs + 2,
  },
  infoLabel: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    width: rs(76),
    marginLeft: SP.sm + 2,
  },
  infoValue: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },
  ordersSection: {
    marginTop: SP.sm,
    paddingTop: SP.md,
    paddingHorizontal: SP.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  ordersTitle: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SP.md,
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
    marginBottom: SP.xs,
  },
  customerOrderNo: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: SP.xs,
  },
  customerName: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: SP.xs,
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: SP.xs,
  },
  locationLabel: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    width: rs(60),
  },
  locationValue: {
    fontSize: FS.xs,
    color: COLORS.textPrimary,
    flex: 1,
  },
  notesSection: {
    marginTop: SP.sm,
    paddingTop: SP.md,
    paddingHorizontal: SP.base,
    paddingBottom: SP.md,
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
    lineHeight: rf(20),
  },

  // ── Documents ────────────────────────────────────────────────────────────────
  documentsSection: {
    marginTop: SP.sm,
    paddingTop: SP.md,
    paddingHorizontal: SP.base,
    paddingBottom: SP.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  documentsTitle: {
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SP.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardLight,
    padding: SP.md,
    borderRadius: RD.md,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: SP.md,
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentName: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: rs(3),
  },
  documentDescription: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginBottom: rs(3),
  },
  documentMeta: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    opacity: 0.7,
  },
  startButton: {
    backgroundColor: COLORS.accentNavyBlue,
    padding: SP.base,
    borderRadius: RD.md,
    marginTop: SP.md,
    marginHorizontal: SP.base,
    marginBottom: SP.base,
    alignItems: 'center',
    shadowColor: COLORS.accentNavyBlue,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.3,
    shadowRadius: rs(4),
    elevation: 3,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: FS.base,
    fontWeight: FONT_WEIGHT.bold,
  },
  // ── Section divider ──────────────────────────────────────────────────────────
  sectionDivider: {
    marginTop: SP.md,
    marginBottom: SP.sm,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  sectionTitle: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentNavyBlue,
    marginBottom: SP.sm,
    letterSpacing: 0.3,
  },

  // ── Appointment ──────────────────────────────────────────────────────────────
  appointmentSection: {
    backgroundColor: 'rgba(0,209,255,0.05)',
    padding: SP.md,
    borderRadius: RD.md,
    marginTop: SP.sm,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  appointmentTitle: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: SP.sm,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ── Stops ────────────────────────────────────────────────────────────────────
  stopsSection: {
    marginTop: SP.md,
    padding: SP.md,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  stopsTitle: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SP.md,
  },
  stopItem: {
    marginBottom: SP.md,
    padding: SP.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RD.sm,
    borderLeftWidth: rs(3),
    borderLeftColor: COLORS.accentBlue,
  },
  stopNumber: {
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
    marginBottom: SP.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SP.sm,
    marginTop: SP.md,
    marginHorizontal: SP.base,
    marginBottom: SP.base,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.statusSuccess,
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.sm,
    borderRadius: RD.md,
    gap: SP.xs + 2,
    shadowColor: COLORS.statusSuccess,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.3,
    shadowRadius: rs(4),
    elevation: 3,
    minHeight: rs(42),
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.statusDanger,
    paddingVertical: SP.sm + 2,
    paddingHorizontal: SP.sm,
    borderRadius: RD.md,
    gap: SP.xs + 2,
    minHeight: rs(42),
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,163,0.10)',
    padding: SP.md,
    borderRadius: RD.md,
    marginTop: SP.md,
    marginHorizontal: SP.base,
    gap: SP.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,255,163,0.25)',
  },
  acceptedBannerText: {
    color: COLORS.accentGreen,
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,63,94,0.10)',
    padding: SP.md,
    borderRadius: RD.md,
    marginTop: SP.md,
    gap: SP.sm,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
  rejectedBannerText: {
    color: COLORS.accentRed,
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
});

export default PendingTrips;
