import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { Colors } from '../../utils/colors';
import { authManager } from '../../types/AuthManager';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

type FilterType = 'monthly' | 'weekly';

interface MileageData {
  month: string;
  totalMiles: number;
  loadedMiles: number;
  emptyMiles: number;
  iftaMiles: number;
  trips: Array<{
    _id: string;
    tripNumber?: string;
    orderNumber?: string;
    startDate: string;
    endDate: string;
    origin: string;
    destination: string;
    distance: number;
    truck?: {
      unitNumber?: string;
      plateNumber?: string;
    };
  }>;
}

export default function MileageSheetScreen() {
  const [allMileageData, setAllMileageData] = useState<MileageData[]>([]);
  const [filteredMileageData, setFilteredMileageData] = useState<MileageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('monthly');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date>(new Date());

  useEffect(() => {
    initializeDates();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchMileageData();
    }
  }, [filterType, startDate, endDate]);

  useEffect(() => {
    // Backend handles grouping, so we just use the data directly
    // Ensure filteredMileageData is always an array
    setFilteredMileageData(Array.isArray(allMileageData) ? allMileageData : []);
  }, [allMileageData]);

  const initializeDates = async () => {
    try {
      // Fetch driver profile to get joining date
      const profileResponse = await apiService.getProfile();
      let joiningDate: Date | null = null;

      if (profileResponse.success && profileResponse.data) {
        const profile = profileResponse.data;
        // Try to get joining date from various possible fields
        if (profile.joiningDate) {
          joiningDate = new Date(profile.joiningDate);
        } else if (profile.createdAt) {
          joiningDate = new Date(profile.createdAt);
        } else if (profile.details?.joiningDate) {
          joiningDate = new Date(profile.details.joiningDate);
        }
      }

      // Fallback to user's createdAt from authManager if profile doesn't have it
      if (!joiningDate) {
        const currentUser = authManager.getCurrentUser();
        if (currentUser && (currentUser as any).createdAt) {
          joiningDate = new Date((currentUser as any).createdAt);
        }
      }

      // Set default dates
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of day

      // If we have a joining date, use it; otherwise use 1 year ago as fallback
      const defaultStartDate = joiningDate || new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      defaultStartDate.setHours(0, 0, 0, 0); // Start of day

      setStartDate(defaultStartDate);
      setEndDate(today);
      setMinDate(defaultStartDate);
      setMaxDate(today);

      logger.info('Initialized date range', {
        startDate: defaultStartDate.toISOString(),
        endDate: today.toISOString(),
        joiningDate: joiningDate?.toISOString(),
      });

      // Fetch mileage data after dates are initialized
      // This will be called after state updates, so we'll use a separate effect
    } catch (error: any) {
      logger.error('Error initializing dates', error);
      // Set fallback dates (1 year ago to today)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      oneYearAgo.setHours(0, 0, 0, 0);
      setStartDate(oneYearAgo);
      setEndDate(today);
      setMinDate(oneYearAgo);
      setMaxDate(today);
    }
  };

  const fetchMileageData = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params: {
        startDate?: string;
        endDate?: string;
        groupBy?: 'monthly' | 'weekly';
      } = {
        groupBy: filterType
      };

      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      // Fetch mileage data from API
      logger.info('Fetching mileage data with params:', params);
      const response = await apiService.getDriverMileage(params);

      logger.info('Mileage API response:', {
        success: response.success,
        hasData: !!response.data,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error,
        message: response.message
      });

      if (response.success && response.data) {
        // Handle nested data structure: backend returns {success: true, data: [...]}
        // API service wraps it as {success: true, data: {success: true, data: [...]}}
        let mileageData: MileageData[] = [];

        if (Array.isArray(response.data)) {
          // Direct array
          mileageData = response.data;
        } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data;
          if (Array.isArray(nestedData)) {
            // Nested data structure
            mileageData = nestedData;
          } else if (nestedData && typeof nestedData === 'object' && 'data' in nestedData && Array.isArray(nestedData.data)) {
            // Double nested
            mileageData = nestedData.data;
          }
        }

        setAllMileageData(mileageData);
        setFilteredMileageData(mileageData);
        logger.info('Mileage data loaded successfully', { count: mileageData.length });

        if (mileageData.length === 0) {
          logger.warn('No mileage data returned from API - check backend logs');
        }
      } else {
        logger.warn('Failed to fetch mileage data', response);
        setAllMileageData([]);
        setFilteredMileageData([]);
        if (response.error) {
          Alert.alert('Error', response.error || 'Failed to load mileage data. Please try again.');
        } else if (!response.success) {
          Alert.alert('Error', response.message || 'Failed to load mileage data. Please try again.');
        }
      }
    } catch (error: any) {
      logger.error('Error fetching mileage data', error);
      Alert.alert('Error', 'Failed to load mileage data. Please try again.');
      setAllMileageData([]);
      setFilteredMileageData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMileageData();
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatMiles = (miles: number): string => {
    return miles.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getWeekRange = (date: Date): { start: Date; end: Date; label: string } => {
    const dateCopy = new Date(date);
    const day = dateCopy.getDay();
    const diff = dateCopy.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(dateCopy.getFullYear(), dateCopy.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return { start: monday, end: sunday, label };
  };

  const groupTripsByWeek = (trips: MileageData['trips']): MileageData[] => {
    const weeklyData: Record<string, MileageData['trips']> = {};

    trips.forEach(trip => {
      const tripDate = new Date(trip.startDate);
      const weekRange = getWeekRange(tripDate);
      const weekKey = weekRange.label;

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = [];
      }
      weeklyData[weekKey].push(trip);
    });

    return Object.entries(weeklyData).map(([weekLabel, weekTrips]) => {
      const totalMiles = weekTrips.reduce((sum, trip) => sum + trip.distance, 0);
      // For demo, assume 85% loaded, 15% empty
      const loadedMiles = totalMiles * 0.85;
      const emptyMiles = totalMiles * 0.15;

      return {
        month: weekLabel,
        totalMiles,
        loadedMiles,
        emptyMiles,
        iftaMiles: totalMiles,
        trips: weekTrips,
      };
    }).sort((a, b) => {
      // Sort by date (most recent first)
      const dateA = new Date(a.trips[0]?.startDate || 0);
      const dateB = new Date(b.trips[0]?.startDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const applyFilters = () => {
    let filtered = [...allMileageData];

    // Apply date range filter
    if (startDate && endDate) {
      filtered = filtered.map(period => {
        const filteredTrips = period.trips.filter(trip => {
          const tripDate = new Date(trip.startDate);
          return tripDate >= startDate && tripDate <= endDate;
        });

        if (filteredTrips.length === 0) return null;

        const totalMiles = filteredTrips.reduce((sum, trip) => sum + trip.distance, 0);
        const loadedMiles = filteredTrips.reduce((sum, trip) => sum + trip.distance * 0.85, 0);
        const emptyMiles = filteredTrips.reduce((sum, trip) => sum + trip.distance * 0.15, 0);

        return {
          ...period,
          totalMiles,
          loadedMiles,
          emptyMiles,
          iftaMiles: totalMiles,
          trips: filteredTrips,
        };
      }).filter((item): item is MileageData => item !== null);
    }

    // Apply weekly grouping if needed
    if (filterType === 'weekly') {
      const allTrips = filtered.flatMap(period => period.trips);
      filtered = groupTripsByWeek(allTrips);
    }

    setFilteredMileageData(filtered);
  };

  const handleDateSelect = (date: Date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    // Validate against min and max dates
    if (minDate) {
      const minDateStart = new Date(minDate);
      minDateStart.setHours(0, 0, 0, 0);
      if (selectedDate < minDateStart) {
        Alert.alert('Invalid Date', `Date cannot be before ${minDateStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
        return;
      }
    }

    const maxDateStart = new Date(maxDate);
    maxDateStart.setHours(0, 0, 0, 0);
    if (selectedDate > maxDateStart) {
      Alert.alert('Invalid Date', 'Date cannot be after today');
      return;
    }

    if (showDatePicker === 'start') {
      setStartDate(selectedDate);
      if (endDate && selectedDate > endDate) {
        setEndDate(null);
      }
    } else if (showDatePicker === 'end') {
      if (startDate && selectedDate < startDate) {
        Alert.alert('Invalid Date', 'End date must be after start date');
        return;
      }
      setEndDate(selectedDate);
    }
    setShowDatePicker(null);
  };

  const resetFilters = () => {
    // Reset to default dates (joining date to today)
    if (minDate) {
      const defaultStart = new Date(minDate);
      defaultStart.setHours(0, 0, 0, 0);
      setStartDate(defaultStart);
    }
    const today = new Date(maxDate);
    today.setHours(23, 59, 59, 999);
    setEndDate(today);
    setFilterType('monthly');
  };

  const renderCalendarModal = () => {
    const today = new Date();
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();

    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const monthName = new Date(displayYear, displayMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const navigateMonth = (direction: 'prev' | 'next') => {
      let newMonth = displayMonth;
      let newYear = displayYear;

      if (direction === 'prev') {
        if (newMonth === 0) {
          newMonth = 11;
          newYear = newYear - 1;
        } else {
          newMonth = newMonth - 1;
        }
      } else {
        if (newMonth === 11) {
          newMonth = 0;
          newYear = newYear + 1;
        } else {
          newMonth = newMonth + 1;
        }
      }

      // Check if the new month/year is within bounds
      const newDate = new Date(newYear, newMonth, 1);
      const maxDateStart = new Date(maxDate);
      maxDateStart.setHours(0, 0, 0, 0);

      if (minDate) {
        const minDateStart = new Date(minDate);
        minDateStart.setHours(0, 0, 0, 0);
        if (newDate < minDateStart) {
          // Don't navigate before min date
          return;
        }
      }

      if (newDate > maxDateStart) {
        // Don't navigate after max date
        return;
      }

      setDisplayMonth(newMonth);
      setDisplayYear(newYear);
    };

    return (
      <Modal
        visible={showCalendarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                {showDatePicker === 'start' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <Ionicons name="close" size={24} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarMonthHeader}>
              <TouchableOpacity onPress={() => navigateMonth('prev')}>
                <Ionicons name="chevron-back" size={24} color={COLORS.accentNavyBlue} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthName}>{monthName}</Text>
              <TouchableOpacity onPress={() => navigateMonth('next')}>
                <Ionicons name="chevron-forward" size={24} color={COLORS.accentNavyBlue} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              <View style={styles.calendarWeekDays}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <Text key={day} style={styles.calendarWeekDay}>{day}</Text>
                ))}
              </View>
              <View style={styles.calendarDays}>
                {days.map((day, index) => {
                  if (day === null) {
                    return <View key={index} style={styles.calendarDay} />;
                  }

                  const date = new Date(displayYear, displayMonth, day);
                  const dateStartOfDay = new Date(date);
                  dateStartOfDay.setHours(0, 0, 0, 0);

                  const todayStart = new Date(maxDate);
                  todayStart.setHours(0, 0, 0, 0);

                  const minDateStart = minDate ? new Date(minDate) : null;
                  if (minDateStart) {
                    minDateStart.setHours(0, 0, 0, 0);
                  }

                  const isStartDate = startDate && dateStartOfDay.toDateString() === startDate.toDateString();
                  const isEndDate = endDate && dateStartOfDay.toDateString() === endDate.toDateString();
                  const isInRange = startDate && endDate && dateStartOfDay >= startDate && dateStartOfDay <= endDate;

                  // Disable dates before minDate or after maxDate
                  const isBeforeMin = minDateStart && dateStartOfDay < minDateStart;
                  const isAfterMax = dateStartOfDay > todayStart;
                  const isDisabled = isBeforeMin || isAfterMax;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        isStartDate && styles.calendarDaySelected,
                        isEndDate && styles.calendarDaySelected,
                        isInRange && !isStartDate && !isEndDate && styles.calendarDayInRange,
                      ]}
                      onPress={() => handleDateSelect(date)}
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isDisabled && styles.calendarDayTextDisabled,
                          (isStartDate || isEndDate) && styles.calendarDayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.calendarActions}>
              <TouchableOpacity
                style={[styles.calendarButton, styles.calendarButtonSecondary]}
                onPress={resetFilters}
              >
                <Text style={styles.calendarButtonTextSecondary}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarButton, styles.calendarButtonPrimary]}
                onPress={() => {
                  setShowCalendarModal(false);
                  setShowDatePicker(null);
                }}
              >
                <Text style={styles.calendarButtonTextPrimary}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mileage Sheet</Text>
        <Text style={styles.headerSubtitle}>View your miles and trip details</Text>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Report Type Row */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Report Type:</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'monthly' && styles.filterButtonActive]}
              onPress={() => setFilterType('monthly')}
            >
              <Ionicons
                name="calendar"
                size={18}
                color={filterType === 'monthly' ? Colors.white : Colors.gray[500]}
              />
              <Text style={[styles.filterButtonText, filterType === 'monthly' && styles.filterButtonTextActive]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'weekly' && styles.filterButtonActive]}
              onPress={() => setFilterType('weekly')}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={filterType === 'weekly' ? Colors.white : Colors.gray[500]}
              />
              <Text style={[styles.filterButtonText, filterType === 'weekly' && styles.filterButtonTextActive]}>
                Weekly
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Range Row */}
        <View style={[styles.filterRow, styles.filterRowLast]}>
          <Text style={styles.filterLabel}>Date Range:</Text>
          <View style={styles.dateFilterRow}>
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => {
                // Show the month of the start date, or min date, or current month
                const dateToShow = startDate || minDate || new Date();
                setDisplayMonth(dateToShow.getMonth());
                setDisplayYear(dateToShow.getFullYear());
                setShowDatePicker('start');
                setShowCalendarModal(true);
              }}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.accentNavyBlue} />
              <Text style={styles.dateFilterText} numberOfLines={1}>
                {startDate
                  ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Start Date'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.dateSeparator}>-</Text>

            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => {
                if (!startDate) {
                  Alert.alert('Select Start Date', 'Please select a start date first');
                  return;
                }
                // Show the month of the end date, or start date, or current month
                const dateToShow = endDate || startDate || new Date();
                setDisplayMonth(dateToShow.getMonth());
                setDisplayYear(dateToShow.getFullYear());
                setShowDatePicker('end');
                setShowCalendarModal(true);
              }}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.accentNavyBlue} />
              <Text style={styles.dateFilterText} numberOfLines={1}>
                {endDate
                  ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'End Date'}
              </Text>
            </TouchableOpacity>

            {(startDate || endDate) && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={resetFilters}
              >
                <Ionicons name="close-circle" size={18} color={Colors.gray[500]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentNavyBlue} />
          <Text style={styles.loadingText}>Loading mileage data...</Text>
        </View>
      ) : !Array.isArray(filteredMileageData) || filteredMileageData.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="speedometer-outline" size={64} color={Colors.gray[400]} />
          <Text style={styles.emptyTitle}>No Mileage Data</Text>
          <Text style={styles.emptySubtitle}>
            Your mileage data will appear here once trips are completed.
            Contact your dispatcher for more information.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredMileageData.map((monthData, index) => (
            <View key={index} style={styles.monthCard}>
              <TouchableOpacity
                style={styles.monthHeader}
                onPress={() => setSelectedMonth(selectedMonth === monthData.month ? null : monthData.month)}
              >
                <View>
                  <Text style={styles.monthTitle}>{monthData.month}</Text>
                  <Text style={styles.monthSummary}>
                    {formatMiles(monthData.totalMiles)} total miles
                  </Text>
                </View>
                <Ionicons
                  name={selectedMonth === monthData.month ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#6B7280"
                />
              </TouchableOpacity>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Loaded</Text>
                  <Text style={styles.statValue}>{formatMiles(monthData.loadedMiles)} mi</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Empty</Text>
                  <Text style={styles.statValue}>{formatMiles(monthData.emptyMiles)} mi</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>IFTA</Text>
                  <Text style={styles.statValue}>{formatMiles(monthData.iftaMiles)} mi</Text>
                </View>
              </View>

              {selectedMonth === monthData.month && (
                <View style={styles.tripsContainer}>
                  <Text style={styles.tripsTitle}>Trip Details</Text>
                  {monthData.trips.map((trip) => (
                    <View key={trip._id} style={styles.tripCard}>
                      <View style={styles.tripHeader}>
                        <Text style={styles.tripNumber}>
                          {trip.tripNumber || trip.orderNumber || 'N/A'}
                        </Text>
                        <Text style={styles.tripDistance}>{formatMiles(trip.distance)} mi</Text>
                      </View>
                      <View style={styles.tripDetails}>
                        <View style={styles.tripDetailRow}>
                          <Ionicons name="location" size={16} color={Colors.gray[500]} />
                          <Text style={styles.tripDetailText}>
                            {trip.origin} → {trip.destination}
                          </Text>
                        </View>
                        <View style={styles.tripDetailRow}>
                          <Ionicons name="calendar" size={16} color={Colors.gray[500]} />
                          <Text style={styles.tripDetailText}>
                            {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                          </Text>
                        </View>
                        {trip.truck && (
                          <View style={styles.tripDetailRow}>
                            <Ionicons name="car" size={16} color={Colors.gray[500]} />
                            <Text style={styles.tripDetailText}>
                              Truck: {trip.truck.unitNumber || trip.truck.plateNumber || 'N/A'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {renderCalendarModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  header: {
    backgroundColor: COLORS.bgCardLight,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
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
  },
  filterSection: {
    backgroundColor: COLORS.bgCardLight,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterRowLast: {
    marginBottom: 0,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    width: 100,
    marginRight: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.gray[100],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    flex: 1,
  },
  filterButtonActive: {
    backgroundColor: COLORS.accentNavyBlue,
    borderColor: COLORS.accentNavyBlue,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray[500],
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.secondary,
    flex: 1,
    minWidth: 100,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.accentNavyBlue,
    flex: 1,
  },
  dateSeparator: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray[400],
    marginHorizontal: 4,
  },
  clearFilterButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calendarModal: {
    backgroundColor: COLORS.bgCardLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
  },
  calendarMonthName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  calendarGrid: {
    marginBottom: 20,
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.accentNavyBlue,
  },
  calendarDayInRange: {
    backgroundColor: COLORS.bgCard,
  },
  calendarDayText: {
    fontSize: 14,
    color: COLORS.accentNavyBlue,
    fontWeight: '500',
  },
  calendarDayTextDisabled: {
    color: COLORS.accentNavyBlue,
  },
  calendarDayTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  calendarActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
  },
  calendarButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calendarButtonPrimary: {
    backgroundColor: COLORS.accentNavyBlue,
  },
  calendarButtonSecondary: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  calendarButtonTextPrimary: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  calendarButtonTextSecondary: {
    color: Colors.gray[600],
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray[500],
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.gray[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  monthCard: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  monthSummary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tripsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  tripsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  tripCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tripDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accentNavyBlue,
  },
  tripDetails: {
    gap: 8,
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: Colors.gray[500],
    flex: 1,
  },
});

