import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api/apiService';
import { COLORS, rs, rf, ri } from '../../theme';

type OnboardingStatus = 'PENDING_TESTS' | 'IN_PROGRESS' | 'WAITING_FOR_HR_APPROVAL' | 'APPROVED' | 'REJECTED';

interface OnboardingProgress {
  status: OnboardingStatus;
  trainingCompleted: boolean;
  testsCompleted: boolean;
  certificatesUploaded: boolean;
  hrApproved: boolean;
  pendingTestsCount?: number;
  pendingTests?: string[];
}

const OnboardingGuardScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    fetchOnboardingStatus();
  }, []);

  // Re-check status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchOnboardingStatus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const fetchOnboardingStatus = async () => {
    try {
      setLoading(true);

      console.log('========================================');
      console.log('📋 FETCHING ONBOARDING STATUS FROM BACKEND');
      console.log('========================================');

      // Get user data
      let userDataStr = await AsyncStorage.getItem('user_data');
      if (!userDataStr) {
        userDataStr = await AsyncStorage.getItem('@fleetgo_user_data');
      }
      if (!userDataStr) {
        userDataStr = await AsyncStorage.getItem('userData');
      }

      if (!userDataStr) {
        console.log('❌ No user data found');
        setLoading(false);
        return;
      }

      const userData = JSON.parse(userDataStr);
      const driverId = userData._id || userData.id;

      if (!driverId) {
        console.log('❌ No driver ID found');
        setLoading(false);
        return;
      }

      console.log('✅ Driver ID:', driverId);
      console.log('📋 Calling backend API...');

      // Call backend API to get onboarding status
      const response = await apiService.getDriverOnboardingStatus(driverId);

      console.log('📋 Backend response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        // Handle nested data structure: response.data.data.data (triple nesting)
        // The backend returns: { success: true, data: { success: true, data: { ... } } }
        let data = response.data;

        // Unwrap nested data structures
        if (data.data && typeof data.data === 'object' && 'trainingCompleted' in data.data) {
          // Triple nesting: response.data.data.data
          data = data.data;
        } else if (data.data && typeof data.data === 'object' && 'success' in data.data && data.data.data) {
          // Double nesting with success wrapper: response.data.data.data
          data = data.data.data;
        } else if (data.data) {
          // Double nesting: response.data.data
          data = data.data;
        }

        console.log('✅ Backend data received (after unwrapping):');
        console.log('   - Training completed:', data.trainingCompleted);
        console.log('   - Tests completed:', data.testsCompleted);
        console.log('   - Certificates uploaded:', data.certificatesUploaded);
        console.log('   - HR approval status:', data.hrApprovalStatus);
        console.log('   - Onboarding status:', data.onboardingStatus);
        console.log('   - Required tests:', data.requiredTests);
        console.log('   - Pending tests count:', data.pendingTestsCount);
        console.log('   - Pending tests:', data.pendingTests);

        // Map backend status to local status
        let status: OnboardingStatus = 'IN_PROGRESS';
        if (data.onboardingStatus === 'APPROVED') {
          status = 'APPROVED';
        } else if (data.onboardingStatus === 'REJECTED') {
          status = 'REJECTED';
        } else if (data.onboardingStatus === 'AWAITING_HR_APPROVAL') {
          status = 'WAITING_FOR_HR_APPROVAL';
        } else if (data.onboardingStatus === 'TESTS_PENDING') {
          status = 'IN_PROGRESS';
        } else if (data.onboardingStatus === 'NOT_STARTED') {
          status = 'PENDING_TESTS';
        }

        // Check if all tests are approved by HR
        const hrApproved = data.allTestsApprovedByHR || data.hrApprovalStatus === 'APPROVED';

        // Update status if all tests are approved
        if (hrApproved && status !== 'APPROVED') {
          status = 'APPROVED';
        }

        const progress: OnboardingProgress = {
          status,
          trainingCompleted: data.trainingCompleted || false,
          testsCompleted: data.testsCompleted || false,
          certificatesUploaded: data.certificatesUploaded || false,
          hrApproved: hrApproved,
          pendingTestsCount: data.pendingTestsCount || 0,
          pendingTests: data.pendingTests || [],
        };

        setProgress(progress);

        console.log('✅ Onboarding status loaded from backend');
        console.log('========================================');
      } else {
        console.error('❌ Failed to get onboarding status:', response.error);
        // Fallback to default state
        setProgress({
          status: 'PENDING_TESTS',
          trainingCompleted: false,
          testsCompleted: false,
          certificatesUploaded: false,
          hrApproved: false,
        });
      }
    } catch (error: any) {
      console.error('========================================');
      console.error('❌ ERROR FETCHING ONBOARDING STATUS');
      console.error('❌ Error:', error);
      console.error('❌ Error message:', error.message);
      console.error('========================================');

      // Fallback to default state
      setProgress({
        status: 'PENDING_TESTS',
        trainingCompleted: false,
        testsCompleted: false,
        certificatesUploaded: false,
        hrApproved: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (): number => {
    if (!progress) return 0;
    let completed = 0;
    const total = 3; // Only count required steps: Training, Tests, HR Approval (not certificates)

    if (progress.trainingCompleted) completed++;
    if (progress.testsCompleted) completed++;
    if (progress.hrApproved) completed++;

    return (completed / total) * 100;
  };

  const getStepStatus = (step: number): 'locked' | 'pending' | 'completed' => {
    if (!progress) return 'locked';

    switch (step) {
      case 1: // Training
        return progress.trainingCompleted ? 'completed' : 'pending';
      case 2: // Tests
        if (!progress.trainingCompleted) return 'locked';
        // Only show as completed if ALL required tests are passed (no pending tests)
        const hasPendingTests = (progress.pendingTestsCount || 0) > 0;
        if (progress.testsCompleted && !hasPendingTests) {
          return 'completed';
        }
        return 'pending';
      case 3: // Certificates (optional)
        // Only unlock if ALL tests are completed (no pending tests)
        const hasPendingTestsForCerts = (progress.pendingTestsCount || 0) > 0;
        if (!progress.testsCompleted || hasPendingTestsForCerts) return 'locked';
        return progress.certificatesUploaded ? 'completed' : 'pending';
      case 4: // HR Approval
        // Only unlock if ALL tests are completed (no pending tests)
        const hasPendingTestsForHR = (progress.pendingTestsCount || 0) > 0;
        if (!progress.testsCompleted || hasPendingTestsForHR) return 'locked';
        return progress.hrApproved ? 'completed' : 'pending';
      default:
        return 'locked';
    }
  };

  const handleContinue = () => {
    if (!progress) return;

    // Skip certificates in the main flow - tests lead directly to HR approval
    if (!progress.trainingCompleted) {
      navigation.navigate('TrainingScreen' as never);
    } else if (!progress.testsCompleted) {
      navigation.navigate('TestsScreen' as never);
    } else if (!progress.hrApproved) {
      navigation.navigate('HRApprovalScreen' as never);
    }
  };

  const getNextStep = (): string => {
    if (!progress) return 'Start Onboarding';

    // Skip certificates in the main flow
    if (!progress.trainingCompleted) return 'Start Training';
    if (!progress.testsCompleted) return 'Take Tests';
    if (!progress.hrApproved) return 'Check HR Approval';
    return 'Complete';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
          <Text style={styles.loadingText}>Loading onboarding status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!progress) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={ri(48)} color={COLORS.accentRed} />
          <Text style={styles.errorText}>Failed to load onboarding status</Text>
        </View>
      </SafeAreaView>
    );
  }

    // If approved on initial load, redirect is handled in fetchOnboardingStatus
    // When navigated from dashboard, always show the verification status

  const progressPercent = calculateProgress();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — compact horizontal bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={ri(24)} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="shield-checkmark" size={ri(18)} color={COLORS.accentBlue} />
            <Text style={styles.headerTitle}>Driver Verification</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Onboarding Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` as any }]} />
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {/* Step 1: Training */}
          <TouchableOpacity
            style={styles.stepCard}
            onPress={() => navigation.navigate('TrainingScreen' as never)}
            disabled={getStepStatus(1) === 'locked'}
          >
            <View style={styles.stepIconContainer}>
              {getStepStatus(1) === 'completed' && (
                <View style={styles.completedIcon}>
                  <Ionicons name="checkmark" size={ri(24)} color={COLORS.white} />
                </View>
              )}
              {getStepStatus(1) === 'pending' && (
                <View style={styles.pendingIcon}>
                  <Ionicons name="time-outline" size={ri(24)} color={COLORS.accentOrange} />
                </View>
              )}
              {getStepStatus(1) === 'locked' && (
                <View style={styles.lockedIcon}>
                  <Ionicons name="lock-closed" size={ri(24)} color={COLORS.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepNumber}>Step 1</Text>
              <Text style={styles.stepTitle}>Watch Training Materials</Text>
              <Text style={styles.stepDescription}>
                Review safety guidelines and training content for TDG, Vehicle Inspection, HOS, and Winter Driving.
              </Text>
              {getStepStatus(1) === 'completed' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              )}
              {getStepStatus(1) === 'pending' && (
                <View style={[styles.statusBadge, styles.pendingBadge]}>
                  <Text style={[styles.statusText, styles.pendingText]}>Pending</Text>
                </View>
              )}
              {getStepStatus(1) === 'locked' && (
                <View style={[styles.statusBadge, styles.lockedBadge]}>
                  <Text style={[styles.statusText, styles.lockedText]}>Locked</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Step 2: Tests */}
          <TouchableOpacity
            style={styles.stepCard}
            onPress={() => {
              console.log('📝 Step 2 clicked - Navigating to TestsScreen');
              if (getStepStatus(2) !== 'locked') {
                navigation.navigate('TestsScreen' as never);
              } else {
                Alert.alert('Locked', 'Please complete training first before taking tests.');
              }
            }}
            disabled={getStepStatus(2) === 'locked'}
          >
            <View style={styles.stepIconContainer}>
              {getStepStatus(2) === 'completed' && (
                <View style={styles.completedIcon}>
                  <Ionicons name="checkmark" size={ri(24)} color={COLORS.white} />
                </View>
              )}
              {getStepStatus(2) === 'pending' && (
                <View style={styles.pendingIcon}>
                  <Ionicons name="time-outline" size={ri(24)} color={COLORS.accentOrange} />
                </View>
              )}
              {getStepStatus(2) === 'locked' && (
                <View style={styles.lockedIcon}>
                  <Ionicons name="lock-closed" size={ri(24)} color={COLORS.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepNumber}>Step 2</Text>
              <Text style={styles.stepTitle}>Pass Required Tests</Text>
              <Text style={styles.stepDescription}>
                Complete mandatory safety tests: TDG, Vehicle Inspection, HOS, and Winter Driving (if applicable).
              </Text>
              {getStepStatus(2) === 'completed' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              )}
              {getStepStatus(2) === 'pending' && (
                <>
                  <View style={[styles.statusBadge, styles.pendingBadge]}>
                    <Text style={[styles.statusText, styles.pendingText]}>Pending</Text>
                  </View>
                  {progress && (progress.pendingTestsCount || 0) > 0 && (
                    <View style={styles.reminderBadge}>
                      <Ionicons name="alert-circle" size={ri(14)} color={COLORS.accentOrange} />
                      <Text style={styles.reminderText}>
                        You have {progress.pendingTestsCount} pending test{progress.pendingTestsCount !== 1 ? 's' : ''}
                        {progress.pendingTests && progress.pendingTests.length > 0 && (
                          <Text> ({progress.pendingTests.join(', ')})</Text>
                        )}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {getStepStatus(2) === 'locked' && (
                <View style={[styles.statusBadge, styles.lockedBadge]}>
                  <Text style={[styles.statusText, styles.lockedText]}>Locked</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Step 3: HR Approval */}
          <TouchableOpacity
            style={styles.stepCard}
            onPress={() => navigation.navigate('HRApprovalScreen' as never)}
            disabled={getStepStatus(4) === 'locked'}
          >
            <View style={styles.stepIconContainer}>
              {getStepStatus(4) === 'completed' && (
                <View style={styles.completedIcon}>
                  <Ionicons name="checkmark" size={ri(24)} color={COLORS.white} />
                </View>
              )}
              {getStepStatus(4) === 'pending' && (
                <View style={styles.pendingIcon}>
                  <Ionicons name="time-outline" size={ri(24)} color={COLORS.accentOrange} />
                </View>
              )}
              {getStepStatus(4) === 'locked' && (
                <View style={styles.lockedIcon}>
                  <Ionicons name="lock-closed" size={ri(24)} color={COLORS.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepNumber}>Step 3</Text>
              <Text style={styles.stepTitle}>HR Approval</Text>
              <Text style={styles.stepDescription}>
                Wait for HR to review and approve your documents. You will be notified once approved.
              </Text>
              {getStepStatus(4) === 'completed' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Approved</Text>
                </View>
              )}
              {getStepStatus(4) === 'pending' && (
                <View style={[styles.statusBadge, styles.pendingBadge]}>
                  <Text style={[styles.statusText, styles.pendingText]}>Pending</Text>
                </View>
              )}
              {getStepStatus(4) === 'locked' && (
                <View style={[styles.statusBadge, styles.lockedBadge]}>
                  <Text style={[styles.statusText, styles.lockedText]}>Locked</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Compliance Message */}
        <View style={styles.complianceBanner}>
          <Ionicons name="information-circle" size={ri(20)} color={COLORS.accentBlue} />
          <Text style={styles.complianceText}>
            <Text style={styles.complianceBold}>Required Steps:</Text> Complete training materials and pass all required tests. HR will review and approve your onboarding.
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue Onboarding →</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Platform.OS === 'android' ? rs(80) : rs(32),
    paddingTop: Platform.OS === 'android' ? rs(8) : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: rs(16),
    fontSize: rf(16),
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs(24),
  },
  errorText: {
    marginTop: rs(16),
    fontSize: rf(16),
    color: COLORS.accentRed,
    textAlign: 'center',
  },
  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderTopWidth: 2,
    borderTopColor: COLORS.accentBlue,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: rs(8),
  },
  placeholder: {
    width: rs(40),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  headerTitle: {
    fontSize: rf(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // ── Progress ─────────────────────────────────────────────────────────────────
  progressSection: {
    backgroundColor: COLORS.bgCard,
    margin: rs(16),
    padding: rs(16),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
  },
  progressLabel: {
    fontSize: rf(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  progressPercent: {
    fontSize: rf(18),
    fontWeight: '700',
    color: COLORS.accentBlue,
  },
  progressBarContainer: {
    height: rs(8),
    backgroundColor: COLORS.bgCardLight,
    borderRadius: rs(4),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accentBlue,
    borderRadius: rs(4),
  },
  // ── Steps ────────────────────────────────────────────────────────────────────
  stepsContainer: {
    padding: rs(16),
    paddingTop: 0,
  },
  stepCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: rs(12),
    padding: rs(16),
    marginBottom: rs(16),
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  stepIconContainer: {
    marginRight: rs(16),
  },
  completedIcon: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    backgroundColor: COLORS.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingIcon: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedIcon: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    backgroundColor: COLORS.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepNumber: {
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: rs(4),
  },
  stepTitle: {
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: rs(6),
  },
  stepDescription: {
    fontSize: rf(13),
    color: COLORS.textSecondary,
    lineHeight: rf(19),
    marginBottom: rs(10),
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,255,163,0.15)',
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rs(16),
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  lockedBadge: {
    backgroundColor: COLORS.bgCardLight,
  },
  statusText: {
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentGreen,
  },
  pendingText: {
    color: COLORS.accentOrange,
  },
  lockedText: {
    color: COLORS.textSecondary,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    marginTop: rs(8),
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: rs(8),
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
  },
  reminderText: {
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentOrange,
  },
  // ── Compliance Banner ────────────────────────────────────────────────────────
  complianceBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,209,255,0.08)',
    margin: rs(16),
    padding: rs(16),
    borderRadius: rs(12),
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentBlue,
  },
  complianceText: {
    flex: 1,
    marginLeft: rs(12),
    fontSize: rf(13),
    color: COLORS.textSecondary,
    lineHeight: rf(19),
  },
  complianceBold: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // ── Continue Button ──────────────────────────────────────────────────────────
  continueButton: {
    backgroundColor: COLORS.accentNavyBlue,
    margin: rs(16),
    padding: rs(16),
    borderRadius: rs(12),
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.white,
  },
  bottomSpacer: {
    height: rs(16),
  },
  // Unused but kept for potential use
  optionalIcon: {
    width: rs(52),
    height: rs(52),
    borderRadius: rs(26),
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionalBadge: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
    borderRadius: rs(8),
  },
  optionalBadgeText: {
    fontSize: rf(10),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

export default OnboardingGuardScreen;
