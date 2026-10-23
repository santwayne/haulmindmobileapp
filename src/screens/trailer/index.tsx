import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { trailerService, Trailer } from '../../services/TrailerService';
import { logger } from '../../utils/loggerHelper';

const TrailerFinder = () => {
  const [searchText, setSearchText] = useState('');
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [filteredTrailers, setFilteredTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<Trailer | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load trailers on component mount
  useEffect(() => {
    loadTrailers();
  }, []);

  // Filter trailers when search text changes
  useEffect(() => {
    filterTrailers();
  }, [searchText, trailers]);

  /**
   * Load all trailers
   */
  const loadTrailers = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      logger.info('Loading trailers', { forceRefresh });

      const result = await trailerService.getAllTrailers(forceRefresh);

      if (result.success && result.data) {
        setTrailers(result.data);
        logger.info('Trailers loaded successfully', { count: result.data.length });
      } else {
        const errorMsg = result.error || 'Failed to load trailers';
        logger.error('Failed to load trailers', { error: errorMsg });
        Alert.alert('Error', errorMsg);
      }
    } catch (error: any) {
      logger.error('Error loading trailers', error);
      Alert.alert('Error', 'An unexpected error occurred while loading trailers');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle pull to refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrailers(true);
    setRefreshing(false);
  };

  /**
   * Filter trailers based on search text
   */
  const filterTrailers = () => {
    if (!searchText.trim()) {
      setFilteredTrailers(trailers);
      return;
    }

    const query = searchText.toLowerCase().trim();
    const filtered = trailers.filter(trailer =>
      trailer.plateNumber.toLowerCase().includes(query) ||
      trailer.trailer.toLowerCase().includes(query)
    );

    setFilteredTrailers(filtered);
    logger.info('Trailers filtered', {
      searchQuery: query,
      totalCount: trailers.length,
      filteredCount: filtered.length
    });
  };

  /**
   * Handle search button press
   */
  const handleSearch = async () => {
    if (!searchText.trim()) {
      setFilteredTrailers(trailers);
      return;
    }

    try {
      setLoading(true);
      logger.info('Searching trailers', { searchQuery: searchText });

      const result = await trailerService.searchTrailers(searchText);

      if (result.success && result.data) {
        setFilteredTrailers(result.data);
        logger.info('Search completed', {
          searchQuery: searchText,
          resultCount: result.data.length
        });
      } else {
        const errorMsg = result.error || 'Search failed';
        Alert.alert('Search Error', errorMsg);
      }
    } catch (error: any) {
      logger.error('Error searching trailers', { searchQuery: searchText, error });
      Alert.alert('Error', 'An unexpected error occurred while searching');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle trailer item press - show details
   */
  const handleTrailerPress = async (trailer: Trailer) => {
    try {
      setLoadingDetails(true);
      setModalVisible(true);
      logger.info('Loading trailer details', { trailerId: trailer._id });

      const result = await trailerService.getTrailerById(trailer._id);

      if (result.success && result.data) {
        setSelectedTrailer(result.data);
        logger.info('Trailer details loaded successfully', { trailerId: trailer._id });
      } else {
        const errorMsg = result.error || 'Failed to load trailer details';
        logger.error('Failed to load trailer details', { error: errorMsg });
        Alert.alert('Error', errorMsg);
        setModalVisible(false);
      }
    } catch (error: any) {
      logger.error('Error loading trailer details', { trailerId: trailer._id, error });
      Alert.alert('Error', 'Failed to load trailer details');
      setModalVisible(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  /**
   * Get status style based on trailer status
   */
  const getStatusStyle = (trailer: Trailer) => {
    const color = trailerService.getStatusColor(trailer.loadStatus, trailer.operationStatus);
    return {
      ...styles.statusText,
      color: color,
    };
  };

  /**
   * Get status text based on trailer status
   */
  const getStatusText = (trailer: Trailer): string => {
    return trailerService.getStatusText(trailer.loadStatus, trailer.operationStatus);
  };

  /**
   * Get last drop location from currentLocation or lastDropLocation
   */
  const getLastDropLocation = (trailer: Trailer): string => {
    if (trailer.currentLocation?.address) {
      return trailer.currentLocation.address;
    }
    if (trailer.lastDropLocation) {
      return trailer.lastDropLocation;
    }
    return 'Location not available';
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Render trailer item
   */
  const renderTrailerItem = (trailer: Trailer) => (
    <TouchableOpacity
      key={trailer._id}
      style={styles.trailerItem}
      onPress={() => handleTrailerPress(trailer)}
      activeOpacity={0.7}
    >
      <View style={styles.trailerHeader}>
        <Text style={styles.trailerText}>
          {trailer.trailer} : {trailer.plateNumber}
        </Text>
        <Text style={getStatusStyle(trailer)}>
          {getStatusText(trailer)}
        </Text>
      </View>

      <View style={styles.trailerDetails}>
        <Text style={styles.trailerSubText}>
          Type: {trailer.type || 'N/A'} • {trailer.ownerShip || 'N/A'}
        </Text>
        <Text style={styles.trailerSubText}>
          Location: {getLastDropLocation(trailer)}
        </Text>
        {trailer.capacity && (
          <Text style={styles.trailerSubText}>
            Capacity: {trailer.capacity}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  /**
   * Render trailer details modal
   */
  const renderTrailerDetailsModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Trailer Details</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loadingDetails ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : selectedTrailer ? (
          <ScrollView style={styles.modalContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Trailer Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Name:</Text>
                <Text style={styles.detailValue}>{selectedTrailer.trailer}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Plate Number:</Text>
                <Text style={styles.detailValue}>{selectedTrailer.plateNumber}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Type:</Text>
                <Text style={styles.detailValue}>{selectedTrailer.type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Ownership:</Text>
                <Text style={styles.detailValue}>{selectedTrailer.ownerShip}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Status Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Operation Status:</Text>
                <Text style={[styles.detailValue, { 
                  color: selectedTrailer.operationStatus?.toLowerCase() === 'available' || 
                         selectedTrailer.operationStatus?.toLowerCase() === 'active' 
                         ? '#10B981' : '#EF4444' 
                }]}>
                  {selectedTrailer.operationStatus || 'N/A'}
                </Text>
              </View>
              {selectedTrailer.status && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Status:</Text>
                  <Text style={styles.detailValue}>{selectedTrailer.status}</Text>
                </View>
              )}
              {selectedTrailer.loadStatus && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Load Status:</Text>
                  <Text style={styles.detailValue}>{selectedTrailer.loadStatus}</Text>
                </View>
              )}
              {selectedTrailer.compilance && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Compliance:</Text>
                  <Text style={[styles.detailValue, { 
                    color: selectedTrailer.compilance.toLowerCase() === 'valid' ? '#10B981' : '#EF4444' 
                  }]}>
                    {selectedTrailer.compilance}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Location Information</Text>
              {selectedTrailer.currentLocation?.address && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Current Location:</Text>
                  <Text style={styles.detailValue}>{selectedTrailer.currentLocation.address}</Text>
                </View>
              )}
              {selectedTrailer.lastDropLocation && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Last Drop Location:</Text>
                  <Text style={styles.detailValue}>{selectedTrailer.lastDropLocation}</Text>
                </View>
              )}
              {selectedTrailer.capacity && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Capacity:</Text>
                  <Text style={styles.detailValue}>{selectedTrailer.capacity}</Text>
                </View>
              )}
              {selectedTrailer.isAttached !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Is Attached:</Text>
                  <Text style={[styles.detailValue, { 
                    color: selectedTrailer.isAttached ? '#10B981' : '#666' 
                  }]}>
                    {selectedTrailer.isAttached ? 'Yes' : 'No'}
                  </Text>
                </View>
              )}
            </View>

            {selectedTrailer.lastDispatch && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Trip Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Last Dispatch:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedTrailer.lastDispatch)}</Text>
                </View>
              </View>
            )}

            {selectedTrailer.sensors && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Sensors</Text>
                {selectedTrailer.sensors.doorStatus && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Door Status:</Text>
                    <Text style={styles.detailValue}>{selectedTrailer.sensors.doorStatus}</Text>
                  </View>
                )}
                {selectedTrailer.sensors.shockDetection !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Shock Detection:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTrailer.sensors.shockDetection ? 'Detected' : 'None'}
                    </Text>
                  </View>
                )}
                {selectedTrailer.sensors.tilting !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Tilting:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTrailer.sensors.tilting ? 'Yes' : 'No'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedTrailer.maintenance && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Maintenance</Text>
                {selectedTrailer.maintenance.tyreCondition && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Tyre Condition:</Text>
                    <Text style={styles.detailValue}>{selectedTrailer.maintenance.tyreCondition}</Text>
                  </View>
                )}
                {selectedTrailer.maintenance.brakeCondition && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Brake Condition:</Text>
                    <Text style={styles.detailValue}>{selectedTrailer.maintenance.brakeCondition}</Text>
                  </View>
                )}
                {selectedTrailer.maintenance.issues && selectedTrailer.maintenance.issues.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Issues:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTrailer.maintenance.issues.join(', ') || 'None'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedTrailer.note && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.noteText}>{selectedTrailer.note}</Text>
              </View>
            )}

          
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <Text style={styles.header}>Find Trailer</Text>

        {/* Search Input with Find Button */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search By Plate or Serial No"
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#999"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity
            style={[styles.findButton, loading && styles.findButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.findButtonText}>Find</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results Summary */}
        {trailers.length > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {filteredTrailers.length} of {trailers.length} trailers
              {searchText ? ` (filtered by "${searchText}")` : ''}
            </Text>
          </View>
        )}

        {/* Trailer List Header */}
        <Text style={styles.listHeader}>Trailer List</Text>

        {/* Loading State */}
        {loading && trailers.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading trailers...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredTrailers.length === 0 && trailers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No trailers found</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadTrailers(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No Search Results */}
        {!loading && filteredTrailers.length === 0 && trailers.length > 0 && searchText && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No trailers match "{searchText}"
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setSearchText('')}
            >
              <Text style={styles.retryButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trailer Items */}
        <View style={styles.trailerList}>
          {filteredTrailers.map(renderTrailerItem)}
        </View>
      </ScrollView>

      {/* Trailer Details Modal */}
      {renderTrailerDetailsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginRight: 10,
  },
  findButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  findButtonDisabled: {
    opacity: 0.7,
  },
  findButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  trailerList: {
    flex: 1,
    paddingBottom: 20,
  },
  trailerItem: {
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
  trailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  trailerText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  trailerDetails: {
    marginTop: 5,
  },
  trailerSubText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  detailLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  detailKey: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    flex: 2,
    textAlign: 'right',
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
});

export default TrailerFinder;