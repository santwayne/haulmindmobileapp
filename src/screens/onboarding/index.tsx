import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';
type OnboardingStatus = 'PENDING_TESTS' | 'IN_PROGRESS' | 'WAITING_FOR_HR_APPROVAL' | 'APPROVED' | 'REJECTED';

interface TestResult {
  id: string;
  testType: TestType;
  score: number;
  passed: boolean;
  attempts: number;
  completedAt: string;
}

interface Certificate {
  id: string;
  verificationType: TestType;
  certificateName: string;
  valid: boolean;
  expiryDate?: string;
}

interface OnboardingData {
  status: OnboardingStatus;
  tests: TestResult[];
  certificates: Certificate[];
  handlesHazardousLoads: boolean;
  winterTestRequired: boolean;
}

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await apiService.getDriverOnboardingStatus();
      
      // Mock data for UI demonstration
      const mockData: OnboardingData = {
        status: 'IN_PROGRESS',
        tests: [
          {
            id: '1',
            testType: 'TDG',
            score: 85,
            passed: true,
            attempts: 1,
            completedAt: new Date().toISOString(),
          },
          {
            id: '2',
            testType: 'VEHICLE',
            score: 0,
            passed: false,
            attempts: 0,
            completedAt: '',
          },
        ],
        certificates: [
          {
            id: '1',
            verificationType: 'TDG',
            certificateName: 'TDG Certificate',
            valid: true,
            expiryDate: '2025-12-31',
          },
        ],
        handlesHazardousLoads: true,
        winterTestRequired: false,
      };

      setOnboardingData(mockData);
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
      Alert.alert('Error', 'Failed to load onboarding data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOnboardingData();
  };

  const getStatusColor = (status: OnboardingStatus) => {
    switch (status) {
      case 'APPROVED':
        return '#10B981'; // green
      case 'REJECTED':
        return '#EF4444'; // red
      case 'WAITING_FOR_HR_APPROVAL':
        return '#F59E0B'; // yellow
      case 'IN_PROGRESS':
        return '#3B82F6'; // blue
      default:
        return '#6B7280'; // gray
    }
  };

  const getStatusLabel = (status: OnboardingStatus) => {
    switch (status) {
      case 'PENDING_TESTS':
        return 'Pending Tests';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'WAITING_FOR_HR_APPROVAL':
        return 'Waiting for HR Approval';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
    }
  };

  const getTestTypeLabel = (type: TestType) => {
    switch (type) {
      case 'TDG':
        return 'TDG';
      case 'VEHICLE':
        return 'Vehicle Inspection';
      case 'HOS':
        return 'Hours of Service';
      case 'WINTER':
        return 'Winter Driving';
    }
  };

  const getTestTypeColor = (type: TestType) => {
    switch (type) {
      case 'TDG':
        return '#EF4444'; // red
      case 'VEHICLE':
        return '#3B82F6'; // blue
      case 'HOS':
        return '#10B981'; // green
      case 'WINTER':
        return '#8B5CF6'; // purple
    }
  };

  const handleStartTest = (testType: TestType) => {
    setSelectedTest(testType);
    setShowTestModal(true);
    // TODO: Navigate to actual test screen
    Alert.alert(
      'Start Test',
      `You are about to start the ${getTestTypeLabel(testType)} test. Are you ready?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            // Navigate to test screen
            Alert.alert('Info', 'Test screen will be implemented here');
          },
        },
      ]
    );
  };

  const requiredTests: TestType[] = ['TDG', 'VEHICLE', 'HOS', 'WINTER'];

  if (loading && !onboardingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading onboarding status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load onboarding data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOnboardingData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Onboarding & Tests</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Onboarding Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(onboardingData.status) + '20' },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: getStatusColor(onboardingData.status) }]}
              />
              <Text
                style={[styles.statusText, { color: getStatusColor(onboardingData.status) }]}
              >
                {getStatusLabel(onboardingData.status)}
              </Text>
            </View>
          </View>

          {onboardingData.status === 'APPROVED' && (
            <View style={styles.approvedMessage}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.approvedText}>
                You have been approved by HR and can now accept trips.
              </Text>
            </View>
          )}

          {onboardingData.status === 'REJECTED' && (
            <View style={styles.rejectedMessage}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
              <Text style={styles.rejectedText}>
                Your onboarding has been rejected. Please contact HR for more information.
              </Text>
            </View>
          )}
        </View>

        {/* Test Results Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          <Text style={styles.sectionSubtitle}>
            Complete all required tests to proceed with onboarding
          </Text>

          {requiredTests.map((testType) => {
            const testResult = onboardingData.tests.find((t) => t.testType === testType);
            const isRequired =
              testType === 'TDG' ? onboardingData.handlesHazardousLoads : true;
            const isWinterRequired = testType === 'WINTER' ? onboardingData.winterTestRequired : true;

            if (testType === 'TDG' && !isRequired) return null;
            if (testType === 'WINTER' && !isWinterRequired) return null;

            const hasResult = testResult && testResult.attempts > 0;
            const passed = testResult?.passed || false;

            return (
              <TouchableOpacity
                key={testType}
                style={[
                  styles.testCard,
                  passed && styles.testCardPassed,
                  hasResult && !passed && styles.testCardFailed,
                ]}
                onPress={() => handleStartTest(testType)}
              >
                <View style={styles.testCardHeader}>
                  <View
                    style={[
                      styles.testTypeBadge,
                      { backgroundColor: getTestTypeColor(testType) + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.testTypeText, { color: getTestTypeColor(testType) }]}
                    >
                      {getTestTypeLabel(testType)}
                    </Text>
                  </View>
                  {hasResult && (
                    <View
                      style={[
                        styles.testStatusBadge,
                        passed
                          ? styles.testStatusPassed
                          : styles.testStatusFailed,
                      ]}
                    >
                      <Ionicons
                        name={passed ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={passed ? '#10B981' : '#EF4444'}
                      />
                      <Text
                        style={[
                          styles.testStatusText,
                          { color: passed ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {passed ? 'Passed' : 'Failed'}
                      </Text>
                    </View>
                  )}
                </View>

                {hasResult ? (
                  <View style={styles.testDetails}>
                    <View style={styles.testDetailRow}>
                      <Text style={styles.testDetailLabel}>Score:</Text>
                      <Text style={styles.testDetailValue}>{testResult.score}%</Text>
                    </View>
                    <View style={styles.testDetailRow}>
                      <Text style={styles.testDetailLabel}>Attempts:</Text>
                      <Text style={styles.testDetailValue}>{testResult.attempts}</Text>
                    </View>
                    {testResult.completedAt && (
                      <View style={styles.testDetailRow}>
                        <Text style={styles.testDetailLabel}>Completed:</Text>
                        <Text style={styles.testDetailValue}>
                          {new Date(testResult.completedAt).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.testAction}>
                    <Ionicons name="play-circle-outline" size={24} color="#0ea3d8" />
                    <Text style={styles.testActionText}>Start Test</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Certificates Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Certificates</Text>
          <Text style={styles.sectionSubtitle}>
            Required certificates for test verification
          </Text>

          {onboardingData.certificates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No certificates uploaded</Text>
              <Text style={styles.emptyStateSubtext}>
                Certificates will be verified by HR after test completion
              </Text>
            </View>
          ) : (
            onboardingData.certificates.map((cert) => (
              <View key={cert.id} style={styles.certificateCard}>
                <View style={styles.certificateHeader}>
                  <View
                    style={[
                      styles.certificateTypeBadge,
                      { backgroundColor: getTestTypeColor(cert.verificationType) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.certificateTypeText,
                        { color: getTestTypeColor(cert.verificationType) },
                      ]}
                    >
                      {getTestTypeLabel(cert.verificationType)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.certificateStatusBadge,
                      cert.valid ? styles.certificateValid : styles.certificateInvalid,
                    ]}
                  >
                    <Ionicons
                      name={cert.valid ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={cert.valid ? '#10B981' : '#EF4444'}
                    />
                    <Text
                      style={[
                        styles.certificateStatusText,
                        { color: cert.valid ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {cert.valid ? 'Valid' : 'Invalid'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.certificateName}>{cert.certificateName}</Text>
                {cert.expiryDate && (
                  <Text style={styles.certificateExpiry}>
                    Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Flags Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver Flags</Text>
          <View style={styles.flagRow}>
            <Ionicons
              name={onboardingData.handlesHazardousLoads ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={onboardingData.handlesHazardousLoads ? '#10B981' : '#9CA3AF'}
            />
            <Text style={styles.flagText}>Handles Hazardous Loads</Text>
            {onboardingData.handlesHazardousLoads && (
              <Text style={styles.flagNote}>(TDG test required)</Text>
            )}
          </View>
          <View style={styles.flagRow}>
            <Ionicons
              name={onboardingData.winterTestRequired ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={onboardingData.winterTestRequired ? '#10B981' : '#9CA3AF'}
            />
            <Text style={styles.flagText}>Winter Test Required</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Platform.OS === 'android' ? 80 : 32,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0ea3d8',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  approvedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    marginTop: 12,
  },
  approvedText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#065F46',
    flex: 1,
  },
  rejectedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginTop: 12,
  },
  rejectedText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#991B1B',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  testCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  testCardPassed: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  testCardFailed: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  testCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  testTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  testTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  testStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  testStatusPassed: {
    backgroundColor: '#D1FAE5',
  },
  testStatusFailed: {
    backgroundColor: '#FEE2E2',
  },
  testStatusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  testDetails: {
    marginTop: 8,
  },
  testDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  testDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  testDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  testAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  testActionText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea3d8',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  certificateCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  certificateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  certificateTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  certificateTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  certificateStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  certificateValid: {
    backgroundColor: '#D1FAE5',
  },
  certificateInvalid: {
    backgroundColor: '#FEE2E2',
  },
  certificateStatusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  certificateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  certificateExpiry: {
    fontSize: 14,
    color: '#6B7280',
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flagText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  flagNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 32,
  },
});

export default OnboardingScreen;

