import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
    uploadedBy?: any;
    uploadedAt?: string;
    description?: string;
  }>;
}

const TripInfoScreen = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  useEffect(() => {
    fetchActiveTrips();
  }, []);

  const fetchActiveTrips = async () => {
    try {
      setLoading(true);
      const response = await apiService.getActiveTrips();

      if (response.success && response.data) {
        const tripsData = response.data.data || response.data || [];
        setTrips(Array.isArray(tripsData) ? tripsData : []);
        logger.info('Active trips fetched for TripInfo', { count: tripsData.length });
      } else {
        logger.warn('Failed to fetch active trips', { error: response.error });
        setTrips([]);
      }
    } catch (error) {
      logger.error('Error fetching active trips', error);
      setTrips([]);
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
      case "planned": return "#95a5a6";
      default: return "#95a5a6";
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading trip information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Trip Information</Text>
          <Text style={styles.headerSubtitle}>View your active trip details</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{trips.length}</Text>
              <Text style={styles.statLabel}>Active Trips</Text>
            </View>
          </View>
        </View>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚛</Text>
          <Text style={styles.emptyText}>No Active Trips</Text>
          <Text style={styles.emptySubtext}>You don't have any active trips at the moment</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {trips.map((trip) => (
            <View key={trip._id} style={styles.tripCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerInfo}>
                  <Text style={styles.tripNumber}>{trip.tripNumber}</Text>
                  <Text style={styles.tripDate}>
                    Started: {formatDate(trip.actualStartDate || trip.plannedStartDate)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                  <Text style={styles.statusText}>{trip.status || 'Active'}</Text>
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
                      <Ionicons name="document-text" size={20} color="#2563eb" />
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
                      <Ionicons name="download-outline" size={20} color="#2563eb" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    backgroundColor: COLORS.bgCardLight,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  tripCard: {
    backgroundColor: COLORS.bgCardLight,
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
  },
  tripNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  ordersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  ordersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  orderItem: {
    backgroundColor: COLORS.bgCardLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  customerOrderNo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  locationValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  orderStatusRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  orderStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  orderStatusValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  documentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  documentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 11,
    color: '#999',
  },
  chatButtonContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  chatButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  chatButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stopsSection: {
    marginTop: 12,
    padding: 8,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 6,
  },
  stopsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  stopItem: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 6,
  },
  stopNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 6,
  },
  sectionDivider: {
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  appointmentSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  appointmentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
});

export default TripInfoScreen;
