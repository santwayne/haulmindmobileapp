import React, { useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
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

const CompleteTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCompletedTrips();
  }, []);

  const fetchCompletedTrips = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCompletedTrips();
      
      if (response.success && response.data) {
        const tripsData = response.data.data || response.data || [];
        setTrips(Array.isArray(tripsData) ? tripsData : []);
        logger.info('Completed trips fetched', { count: tripsData.length });
      } else {
        logger.warn('Failed to fetch completed trips', { error: response.error });
        setTrips([]);
      }
    } catch (error) {
      logger.error('Error fetching completed trips', error);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompletedTrips();
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

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
          <Text style={styles.loadingText}>Loading completed trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* ── Compact Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerGlowLine} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Completed Trips</Text>
            <Text style={styles.headerSubtitle}>Your trip history</Text>
          </View>
          <View style={styles.countBadge}>
            <Ionicons name="checkmark-circle" size={ri(14)} color={COLORS.accentGreen} />
            <Text style={styles.countBadgeText}>{trips.length}</Text>
          </View>
        </View>
      </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.accentBlue]}
            tintColor={COLORS.accentBlue}
          />
        }
      >
        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No completed trips</Text>
            <Text style={styles.emptySubtext}>You don't have any completed trips yet.</Text>
          </View>
        ) : (
          trips.map((trip) => (
            <View key={trip._id} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <View>
                  <Text style={styles.tripNumber}>{trip.tripNumber}</Text>
                  <Text style={styles.tripDate}>
                    Completed: {formatDate(trip.actualEndDate || trip.plannedEndDate)}
                    </Text>
                  </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
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

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Started:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(trip.actualStartDate || trip.plannedStartDate)}
                </Text>
                    </View>

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
              </View>
          ))
        )}
        </ScrollView>
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

  // ── Compact Header ───────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.bgCard,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  headerGlowLine: {
    height: 2,
    backgroundColor: COLORS.accentGreen,
    opacity: 0.6,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SP.base,
    paddingVertical: SP.md,
  },
  headerTitle: {
    fontSize: FS.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FS.xs,
    color: COLORS.textSecondary,
    marginTop: rs(2),
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    backgroundColor: 'rgba(0,255,163,0.10)',
    paddingHorizontal: SP.md,
    paddingVertical: SP.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accentGreen,
  },
  countBadgeText: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentGreen,
  },

  // ── Loading / Empty ──────────────────────────────────────────────────────────
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

  // ── Trip Card ────────────────────────────────────────────────────────────────
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
    backgroundColor: 'rgba(0,255,163,0.12)',
    paddingHorizontal: SP.md,
    paddingVertical: rs(5),
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accentGreen,
  },
  statusText: {
    color: COLORS.accentGreen,
    fontSize: FS.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // ── Info rows ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    marginBottom: SP.sm,
    paddingHorizontal: SP.base,
  },
  infoLabel: {
    fontSize: FS.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    width: rs(80),
  },
  infoValue: {
    fontSize: FS.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // ── Orders section ───────────────────────────────────────────────────────────
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

  // ── Notes ────────────────────────────────────────────────────────────────────
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
});

export default CompleteTrips;
