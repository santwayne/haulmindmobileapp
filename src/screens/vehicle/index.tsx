import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Vehicle, VehicleFilter } from '../../types/Vehicle';
import { vehicleService } from '../../services/VehicleService';

interface DocumentInfo {
  status: "completed" | "expired" | "pending";
  expiryDate: string;
}

const VehicleFinderIntegrated = () => {
  const [searchText, setSearchText] = useState('');
  const [currentScreen, setCurrentScreen] = useState('vehicleList'); // 'vehicleList' or 'vehicleDetails'
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<VehicleFilter>('all');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current user location (Ludhiana, Punjab)
  const userLocation = { lat: 30.9010, lng: 75.8573, city: 'Ludhiana', state: 'Punjab' };

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await vehicleService.getVehicles('all');
      setVehicles(result);
    } catch (err) {
      setError('Failed to load vehicles');
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle search functionality - search by plate number
  const handleSearch = async () => {
    if (!searchText.trim()) {
      // If search is empty, reload all vehicles
      await loadVehicles();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await vehicleService.searchVehiclesByPlate(searchText);
      setVehicles(result);
    } catch (err) {
      setError('Search failed');
      console.error('Error searching vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance with safe parsing
  const calculateDistance = (vehicleLat: string, vehicleLng: string): number => {
    try {
      const lat1 = parseFloat(vehicleLat) || userLocation.lat;
      const lng1 = parseFloat(vehicleLng) || userLocation.lng;

      // Simple distance approximation
      const latDiff = Math.abs(lat1 - userLocation.lat);
      const lngDiff = Math.abs(lng1 - userLocation.lng);
      return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
    } catch {
      return 0; // Return 0 if calculation fails
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'available':
        return [styles.statusText, styles.availableStatus];
      case 'in-use':
        return [styles.statusText, styles.serviceStatus];
      case 'maintenance':
        return [styles.statusText, styles.serviceStatus];
      default:
        return [styles.statusText, styles.defaultStatus];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'in-use':
        return 'In Use';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
    }
  };

  // Mock document status for demonstration
  const getVehicleDocuments = (vehicleId: string): Record<string, DocumentInfo> => {
    return {
      registration: { status: 'completed', expiryDate: '2025-12-15' },
      insurance: { status: 'pending', expiryDate: '2025-08-30' },
      permit: { status: 'expired', expiryDate: '2025-07-20' },
      fitness: { status: 'completed', expiryDate: '2026-03-10' },
    };
  };

  const getDocumentStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return [styles.docStatusText, styles.completedDoc];
      case 'pending':
        return [styles.docStatusText, styles.pendingDoc];
      case 'expired':
        return [styles.docStatusText, styles.expiredDoc];
      default:
        return [styles.docStatusText, styles.defaultDoc];
    }
  };

  const getDocumentStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'expired':
        return 'Expired';
      default:
        return 'Not Available';
    }
  };

  const handleVehiclePress = async (vehicle: Vehicle) => {
    try {
      setLoading(true);

      const result = await vehicleService.getSelectedVehicle(vehicle._id);

      if (result.success) {
        // Explicitly narrow/cast result as API response
        const vehicleData: Vehicle =
          (result as { data?: { data?: Vehicle } }).data?.data ??
          (result as { data?: Vehicle }).data ??
          vehicle;

        setSelectedVehicle(vehicleData);
        setCurrentScreen("vehicleDetails");
      }
    } catch (err) {
      setSelectedVehicle(vehicle);
      setCurrentScreen("vehicleDetails");
    } finally {
      setLoading(false);
    }
  };


  const handleBackPress = () => {
    setCurrentScreen('vehicleList');
    setSelectedVehicle(null);
  };

  const handleFilterPress = async (filter: VehicleFilter) => {
    setFilterType(filter);

    try {
      setLoading(true);
      setError(null);

      let filteredVehicles = vehicles;

      if (searchText.trim()) {
        // If there's a search term, get fresh results
        const result = await vehicleService.searchVehiclesByPlate(searchText);
        filteredVehicles = result;
      } else if (vehicles.length === 0) {
        // If no vehicles loaded, load them first
        const result = await vehicleService.getVehicles('all');
        filteredVehicles = result;
      }

      // Apply filter on the frontend
      switch (filter) {
        case 'nearby':
          filteredVehicles = vehicleService.filterVehiclesNearby(filteredVehicles, userLocation.lat, userLocation.lng);
          break;
        case 'trailer':
          filteredVehicles = vehicleService.filterVehiclesWithTrailers(filteredVehicles, true);
          break;
        case 'all':
        default:
          // No additional filtering needed
          break;
      }

      setVehicles(filteredVehicles);
    } catch (err) {
      setError('Failed to filter vehicles');
      console.error('Error filtering vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (documentName: string) => {
    // In real implementation, this would open the document viewer
    Alert.alert('View Document', `Opening ${documentName}...`, [
      { text: 'OK', onPress: () => console.log(`Viewing document: ${documentName}`) }
    ]);
  };

  const getFilteredVehicles = () => {
    return vehicles;
  };

  const renderVehicleList = () => (
    <View style={styles.content}>
      {/* Header */}
      <Text style={styles.header}>Find Vehicle</Text>

      {/* Search Input + Find Button in one row */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search By Plate Number"
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.findButton} onPress={handleSearch}>
          <Text style={styles.findButtonText}>Find</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Buttons - Only All Vehicles, Nearby, Has Trailer */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => handleFilterPress('all')}
        >
          <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
            All Vehicles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'nearby' && styles.filterButtonActive]}
          onPress={() => handleFilterPress('nearby')}
        >
          <Text style={[styles.filterButtonText, filterType === 'nearby' && styles.filterButtonTextActive]}>
            Nearby
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'trailer' && styles.filterButtonActive]}
          onPress={() => handleFilterPress('trailer')}
        >
          <Text style={[styles.filterButtonText, filterType === 'trailer' && styles.filterButtonTextActive]}>
            Has Trailer
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vehicle List Header */}
      <Text style={styles.listHeader}>
        Vehicle List ({getFilteredVehicles().length} found)
      </Text>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadVehicles}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Vehicle Items */}
      {!loading && !error && (
        <View style={styles.vehicleList}>
          {getFilteredVehicles().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No vehicles found</Text>
              <Text style={styles.emptySubText}>
                Try adjusting your search or filter criteria
              </Text>
            </View>
          ) : (
            getFilteredVehicles().map((vehicle) => {
              const distance = calculateDistance(
                vehicle.coordinates?.latitude || '0',
                vehicle.coordinates?.longitude || '0'
              );

              return (
                <TouchableOpacity
                  key={vehicle._id}
                  style={styles.vehicleItem}
                  onPress={() => handleVehiclePress(vehicle)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vehicleText}>
                    {vehicle.make} {vehicle.model} : Plate: {vehicle.plateNumber}
                  </Text>
                  <Text style={styles.vehicleSubText}>
                    S.No: {vehicle.internalId} | VIN: {vehicle.vinNumber}
                  </Text>

                  <View style={styles.vehicleDetailsRow}>
                    <Text style={getStatusStyle(vehicle.status)}>
                      {getStatusText(vehicle.status)}
                    </Text>
                    {vehicle.hasTrailer && (
                      <Text style={styles.trailerBadge}>Trailer Attached</Text>
                    )}
                  </View>

                  <View style={styles.locationRow}>
                    <Text style={styles.locationText}>
                      Year: {vehicle.year}
                    </Text>
                    <Text style={styles.distanceText}>
                      {distance < 1
                        ? `${(distance * 1000).toFixed(0)}m away`
                        : `${distance.toFixed(1)}km away`
                      }
                    </Text>
                  </View>

                  {vehicle.hasTrailer && vehicle.trailerDetails && (
                    <Text style={styles.trailerInfo}>
                      Trailer: {vehicle.trailerDetails.serialNumber}
                      ({vehicle.trailerDetails.capacity})
                    </Text>
                  )}

                  <Text style={styles.tapHint}>Tap to view details</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );

  const renderVehicleDetails = () => {
    if (!selectedVehicle) return null;

    const documents = getVehicleDocuments(selectedVehicle._id);
    const distance = calculateDistance(
      selectedVehicle.coordinates?.latitude || '0',
      selectedVehicle.coordinates?.longitude || '0'
    );

    return (
      <View style={styles.content}>
        {/* Header with Back Button */}
        <View style={styles.documentsHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Vehicle Details</Text>
        </View>

        {/* Vehicle Info Card */}
        <View style={styles.vehicleInfoCard}>
          <Text style={styles.vehicleInfoText}>
            {selectedVehicle.make} {selectedVehicle.model} : Plate: {selectedVehicle.plateNumber}
          </Text>
          <Text style={styles.vehicleSubText}>
            S.No: {selectedVehicle.internalId} | VIN: {selectedVehicle.vinNumber}
          </Text>

          <View style={styles.vehicleDetailsRow}>
            <Text style={getStatusStyle(selectedVehicle.status)}>
              {getStatusText(selectedVehicle.status)}
            </Text>
            {selectedVehicle.hasTrailer && (
              <Text style={styles.trailerBadge}>Trailer Attached</Text>
            )}
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationText}>
              Year: {selectedVehicle.year}
            </Text>
            <Text style={styles.distanceText}>
              {distance < 1
                ? `${(distance * 1000).toFixed(0)}m away`
                : `${distance.toFixed(1)}km away`
              }
            </Text>
          </View>

          {/* Trailer Details */}
          {selectedVehicle.hasTrailer && selectedVehicle.trailerDetails && (
            <View style={styles.trailerDetailsCard}>
              <Text style={styles.trailerTitle}>Trailer Details:</Text>
              <Text style={styles.trailerDetail}>
                Serial No: {selectedVehicle.trailerDetails.serialNumber}
              </Text>
              <Text style={styles.trailerDetail}>
                Capacity: {selectedVehicle.trailerDetails.capacity}
              </Text>
              <Text style={styles.trailerDetail}>
                Status: {selectedVehicle.trailerDetails.status}
              </Text>
            </View>
          )}
        </View>

        {/* Documents Section */}
        {selectedVehicle.documents && selectedVehicle.documents.length > 0 && (
          <>
            <Text style={styles.listHeader}>Documents</Text>
            <View style={styles.documentsList}>
              {selectedVehicle.documents.map((document, index) => (
                <View key={index} style={styles.documentItem}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentType}>
                      {document.charAt(0).toUpperCase() + document.slice(1)}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewDocButton}
                      onPress={() => handleViewDocument(document)}
                    >
                      <Text style={styles.viewDocButtonText}>View Document</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Mock Documents Status */}
        <Text style={styles.listHeader}>Documents Status</Text>
        <View style={styles.documentsList}>
          {Object.entries(documents).map(([docType, docInfo]) => (
            <View key={docType} style={styles.documentItem}>
              <View style={styles.documentHeader}>
                <Text style={styles.documentType}>
                  {docType.charAt(0).toUpperCase() + docType.slice(1)}
                </Text>
                <Text style={getDocumentStatusStyle(docInfo.status)}>
                  {getDocumentStatusText(docInfo.status)}
                </Text>
              </View>
              <Text style={styles.expiryText}>
                Expiry Date: {docInfo.expiryDate}
              </Text>
              {docInfo.status === 'expired' && (
                <Text style={styles.warningText}>Document has expired</Text>
              )}
              {docInfo.status === 'pending' && (
                <Text style={styles.pendingText}>Action required</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadVehicles}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
      >
        {currentScreen === 'vehicleList' ? renderVehicleList() : renderVehicleDetails()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default VehicleFinderIntegrated;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  documentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginRight: 8,
    color: "#000",
  },
  findButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  findButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 44,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  vehicleList: {
    flex: 1,
  },
  vehicleItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  vehicleText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  vehicleSubText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 2,
  },
  availableStatus: {
    color: '#10B981',
  },
  serviceStatus: {
    color: '#EF4444',
  },
  defaultStatus: {
    color: '#666',
  },
  tapHint: {
    fontSize: 12,
    color: '#8B5CF6',
    fontStyle: 'italic',
    marginTop: 5,
  },
  vehicleInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  vehicleInfoText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  documentsList: {
    flex: 1,
  },
  documentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  viewDocButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewDocButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  docStatusText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  completedDoc: {
    color: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  pendingDoc: {
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  expiredDoc: {
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  defaultDoc: {
    color: '#666',
    backgroundColor: '#F3F4F6',
  },
  expiryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  pendingText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  vehicleDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  trailerBadge: {
    fontSize: 12,
    color: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  distanceText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  trailerInfo: {
    fontSize: 12,
    color: '#8B5CF6',
    fontStyle: 'italic',
    marginTop: 3,
  },
  trailerDetailsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  trailerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  trailerDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  debugCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  coordinatesCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  coordinatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
    marginBottom: 5,
  },
  coordinatesText: {
    fontSize: 13,
    color: '#0369A1',
    marginBottom: 2,
  },
  imagesCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  imagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    marginBottom: 5,
  },
  imagesCount: {
    fontSize: 13,
    color: '#15803D',
  },
  noImagesText: {
    fontSize: 13,
    color: '#15803D',
    fontStyle: 'italic',
  },
  emptyDocumentsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  emptyDocumentsText: {
    fontSize: 14,
    color: '#D97706',
    textAlign: 'center',
    fontStyle: 'italic',
  },

});