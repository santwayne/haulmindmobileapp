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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../../services/api/apiService';
import { COLORS, rs, rf, ri } from '../../theme';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';

interface TestResult {
  id: string | null;
  testType: TestType;
  score: number;
  passed: boolean;
  attempts: number;
  status: 'not_taken' | 'failed' | 'passed';
  mandatory: boolean;
  completedAt?: string | null;
  hrApproved?: boolean;
  hrRejected?: boolean;
  hrApprovedBy?: string;
  hrApprovedAt?: string;
  hrRejectionReason?: string;
}

interface DriverFlags {
  handlesHazardousLoads: boolean;
  winterTestRequired: boolean;
}

const TestsScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [driverFlags, setDriverFlags] = useState<DriverFlags | null>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  // Refresh tests when screen comes into focus (e.g., after submitting a test)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 TestsScreen focused - refreshing test data...');
      fetchTests();
    }, [])
  );

  const fetchTests = async () => {
    try {
      setLoading(true);

      console.log('📱 Fetching user data from storage...');

      // Try multiple storage keys for backward compatibility
      let userDataStr = await AsyncStorage.getItem('user_data');
      if (!userDataStr) {
        userDataStr = await AsyncStorage.getItem('@fleetgo_user_data');
      }
      if (!userDataStr) {
        userDataStr = await AsyncStorage.getItem('userData');
      }

      if (!userDataStr) {
        console.log('❌ No user data found in any storage key');
        Alert.alert('Error', 'User data not found. Please login again.');
        return;
      }

      console.log('✅ User data found in storage');
      const userData = JSON.parse(userDataStr);
      const driverId = userData._id || userData.id;

      if (!driverId) {
        console.log('❌ No driver ID in user data:', userData);
        Alert.alert('Error', 'Invalid user data. Please login again.');
        return;
      }

      console.log('✅ Driver ID:', driverId);
      console.log('========================================');
      console.log('📱 Step 2: Calling API to get test status...');

      // Call the API
      const response = await apiService.getDriverTestStatus(driverId);

      console.log('📱 Step 3: Received response from backend');
      console.log('📱 Response success:', response.success);
      console.log('📱 Full response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        // Handle nested data structure: response.data.data
        const data = response.data.data || response.data;

        console.log('📱 Extracted data:', JSON.stringify(data, null, 2));

        const testsData: TestResult[] = data.tests || [];
        const flags: DriverFlags = data.driverFlags || {
          handlesHazardousLoads: false,
          winterTestRequired: false
        };
        const requiredTests = data.requiredTests || [];

        console.log('✅ Tests loaded from backend:', testsData.length, 'tests');
        console.log('✅ Driver flags:', JSON.stringify(flags, null, 2));
        console.log('✅ Required test types:', requiredTests);

        // Log each test
        testsData.forEach((test, index) => {
          console.log(`📝 Test ${index + 1}:`, {
            testType: test.testType,
            status: test.status,
            score: test.score,
            passed: test.passed,
            mandatory: test.mandatory,
            attempts: test.attempts
          });
        });

        setTests(testsData);
        setDriverFlags(flags);

        // Check if all mandatory tests passed
        const mandatoryTests = testsData.filter(t => t.mandatory);
        const allMandatoryPassed = mandatoryTests.every(t => t.status === 'passed');
        setAllTestsPassed(allMandatoryPassed);

        console.log('📊 Mandatory tests count:', mandatoryTests.length);
        console.log('📊 All mandatory tests passed:', allMandatoryPassed);

        // Save tests completion status to AsyncStorage
        if (allMandatoryPassed) {
          await AsyncStorage.setItem('testsCompleted', 'true');
          console.log('✅ Tests completion status saved to AsyncStorage');
        } else {
          await AsyncStorage.setItem('testsCompleted', 'false');
        }

        console.log('========================================');
        console.log('✅ TESTS LOADED SUCCESSFULLY');
        console.log('========================================');
      } else {
        console.error('❌ API returned error:', response.error || response.message);
        Alert.alert('Error', response.error || response.message || 'Failed to load tests');
      }
    } catch (error: any) {
      console.error('========================================');
      console.error('❌ ERROR FETCHING TESTS');
      console.error('❌ Error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('========================================');
      Alert.alert('Error', `Failed to load tests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = (test: TestResult) => {
    Alert.alert(
      `Start ${getTestTypeLabel(test.testType)} Test`,
      `You are about to start the ${getTestTypeLabel(test.testType)} test.\n\n${test.mandatory ? 'This is a mandatory test.' : 'This is an optional test.'}\n\nAre you ready to begin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Test',
          onPress: () => {
            console.log('🚀 Navigating to TakeTestScreen for test type:', test.testType);
            try {
              navigation.navigate('TakeTestScreen', { testType: test.testType });
            } catch (error) {
              console.error('❌ Navigation error:', error);
              Alert.alert('Error', 'Failed to start test. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleRetakeTest = (test: TestResult) => {
    Alert.alert(
      `Retake ${getTestTypeLabel(test.testType)} Test`,
      `You scored ${test.score}% on your last attempt.\n\nDo you want to retake this test?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retake Test',
          onPress: () => {
            console.log('🚀 Navigating to TakeTestScreen for retake:', test.testType);
            try {
              navigation.navigate('TakeTestScreen', { testType: test.testType });
            } catch (error) {
              console.error('❌ Navigation error:', error);
              Alert.alert('Error', 'Failed to start test. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleViewResults = (test: TestResult) => {
    Alert.alert(
      `${getTestTypeLabel(test.testType)} Results`,
      `Score: ${test.score}%\nStatus: ${test.status === 'passed' ? 'Passed ✅' : 'Failed ❌'}\nAttempts: ${test.attempts}`,
      [
        { text: 'OK' },
        test.status !== 'passed' && {
          text: 'Retake Test',
          onPress: () => handleRetakeTest(test)
        }
      ].filter(Boolean) as any
    );
  };

  const OLD_handleStartTest = (test: TestResult) => {
    Alert.alert(
      `Start ${getTestTypeLabel(test.testType)} Test`,
      `You are about to start the ${getTestTypeLabel(test.testType)} test.\n\n${test.mandatory ? 'This is a mandatory test.' : 'This is an optional test.'}\n\nAre you ready to begin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Test',
          onPress: () => {
            // OLD IMPLEMENTATION
            Alert.alert(
              'Test Screen',
              'The test interface will be implemented here. For now, this is a placeholder.',
              [
                {
                  text: 'Simulate Pass',
                  onPress: () => {
                    setTests(prev =>
                      prev.map(t =>
                        t.id === test.id
                          ? {
                            ...t,
                            score: 85,
                            passed: true,
                            attempts: t.attempts + 1,
                            status: 'passed',
                          }
                          : t
                      )
                    );
                    // Recheck all passed
                    const updated = tests.map(t =>
                      t.id === test.id
                        ? {
                          ...t,
                          score: 85,
                          passed: true,
                          attempts: t.attempts + 1,
                          status: 'passed',
                        }
                        : t
                    );
                    const mandatoryTests = updated.filter(t => t.mandatory);
                    const allMandatoryPassed = mandatoryTests.every(t => t.status === 'passed');
                    setAllTestsPassed(allMandatoryPassed);
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    if (!allTestsPassed) {
      Alert.alert(
        'Tests Incomplete',
        'You must pass all required safety tests before accessing trips.',
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('HRApprovalScreen' as never);
  };

  const getTestTypeLabel = (type: TestType) => {
    switch (type) {
      case 'TDG':
        return 'TDG';
      case 'VEHICLE':
        return 'Vehicle Inspection';
      case 'HOS':
        return 'HOS';
      case 'WINTER':
        return 'Winter Driving';
    }
  };

  const getTestTypeColor = (type: TestType) => {
    switch (type) {
      case 'TDG':
        return '#EF4444';
      case 'VEHICLE':
        return '#3B82F6';
      case 'HOS':
        return '#10B981';
      case 'WINTER':
        return '#8B5CF6';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mandatoryTests = tests.filter(t => t.mandatory);
  const allMandatoryPassed = mandatoryTests.every(t => t.status === 'passed');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Tests</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning if tests not passed */}
        {!allMandatoryPassed && (
          <View style={styles.warningBanner}>
            <Ionicons name="lock-closed" size={24} color="#EF4444" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Trips Locked 🔒</Text>
              <Text style={styles.warningText}>
                You must pass all required safety tests before accessing trips.
              </Text>
            </View>
          </View>
        )}

        {/* Driver Flags Info */}
        {driverFlags && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#0ea3d8" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Your Required Tests</Text>
              <Text style={styles.infoText}>
                Based on your driver profile:
              </Text>
              <View style={styles.flagsList}>
                <Text style={styles.flagItem}>✓ Vehicle Inspection & HOS (Base Tests)</Text>
                {driverFlags.handlesHazardousLoads && (
                  <Text style={styles.flagItem}>✓ TDG Test (Hazardous Loads)</Text>
                )}
                {driverFlags.winterTestRequired && (
                  <Text style={styles.flagItem}>✓ Winter Driving Test (Winter Season)</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Test Cards */}
        {tests.map((test, index) => (
          <View
            key={test.id || test.testType || `test-${index}`}
            style={[
              styles.testCard,
              test.status === 'passed' && styles.testCardPassed,
              test.status === 'failed' && styles.testCardFailed,
            ]}
          >
            <View style={styles.testCardHeader}>
              <View
                style={[
                  styles.testTypeBadge,
                  { backgroundColor: getTestTypeColor(test.testType) + '20' },
                ]}
              >
                <Text
                  style={[styles.testTypeText, { color: getTestTypeColor(test.testType) }]}
                >
                  {getTestTypeLabel(test.testType)} Test
                </Text>
              </View>
              {test.mandatory && (
                <View style={styles.mandatoryBadge}>
                  <Text style={styles.mandatoryText}>Required</Text>
                </View>
              )}
            </View>

            <View style={styles.testStatusRow}>
              <View style={styles.statusContainer}>
                <Text style={styles.statusLabel}>Status:</Text>
                {test.status === 'passed' && (
                  <View style={styles.statusBadgePassed}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.statusTextPassed}>Passed</Text>
                  </View>
                )}
                {test.status === 'failed' && (
                  <View style={styles.statusBadgeFailed}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                    <Text style={styles.statusTextFailed}>Failed</Text>
                  </View>
                )}
                {test.status === 'not_taken' && (
                  <View style={styles.statusBadgeNotTaken}>
                    <Text style={styles.statusTextNotTaken}>Not Taken</Text>
                  </View>
                )}
              </View>
              {test.status !== 'not_taken' && (
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreLabel}>Score:</Text>
                  <Text style={styles.scoreValue}>{test.score}%</Text>
                </View>
              )}
            </View>

            {/* HR Approval Status */}
            {test.status !== 'not_taken' && (
              <View style={styles.hrApprovalContainer}>
                <Text style={styles.hrApprovalLabel}>HR Approval:</Text>
                {test.hrApproved ? (
                  <View style={styles.hrApprovalBadgeApproved}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.hrApprovalTextApproved}>Approved</Text>
                  </View>
                ) : test.hrRejected ? (
                  <View style={styles.hrApprovalBadgeRejected}>
                    <Ionicons name="close-circle" size={14} color="#EF4444" />
                    <Text style={styles.hrApprovalTextRejected}>Rejected</Text>
                    {test.hrRejectionReason && (
                      <Text style={styles.hrRejectionReason}>Reason: {test.hrRejectionReason}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.hrApprovalBadgePending}>
                    <Ionicons name="time-outline" size={14} color="#F59E0B" />
                    <Text style={styles.hrApprovalTextPending}>Pending Review</Text>
                  </View>
                )}
              </View>
            )}

            {test.attempts > 0 && (
              <Text style={styles.attemptsText}>Attempts: {test.attempts}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.startButton,
                test.status === 'passed' && styles.startButtonPassed,
              ]}
              onPress={() => handleStartTest(test)}
            >
              {test.status === 'passed' ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Test Passed</Text>
                </>
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Start Test</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !allMandatoryPassed && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!allMandatoryPassed}
        >
          <Text style={styles.continueButtonText}>
            {allMandatoryPassed ? 'Continue to HR Approval →' : 'Go to Trips (Disabled)'}
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 2,
    borderTopColor: COLORS.accentBlue,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: rf(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'android' ? 80 : 32,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgMain,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea3d8',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  flagsList: {
    marginTop: 4,
  },
  flagItem: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 2,
  },
  testCard: {
    backgroundColor: COLORS.bgCard, // ✅ FIX (was bgMain)
    borderRadius: rs(12),
    padding: rs(16),
    marginBottom: rs(12),

    flexDirection: 'column',

    borderWidth: 1,
    borderColor: COLORS.borderSubtle,

    // ✅ modern depth
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  testCardPassed: {
    borderColor: COLORS.accentGreen,
    backgroundColor: 'rgba(0,255,163,0.08)', // ✅ match training viewed
  },

  testCardFailed: {
    borderColor: COLORS.accentOrange, // ❗ change from red → orange (consistent system)
    backgroundColor: 'rgba(255,165,0,0.08)',
  },

  testCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
  },

  testTypeBadge: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rs(20), // smoother pill
  },

  testTypeText: {
    fontSize: rf(15),
    fontWeight: '700',
  },

  mandatoryBadge: {
    backgroundColor: 'rgba(255,165,0,0.15)', // subtle orange
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  mandatoryText: {
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentOrange,
  },

  testStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusLabel: {
    fontSize: rf(13),
    color: COLORS.textSecondary,
    marginRight: rs(6),
  },

  // ✅ PASSED
  statusBadgePassed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,163,0.12)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  statusTextPassed: {
    marginLeft: rs(4),
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentGreen,
  },

  // ✅ FAILED (use orange instead of harsh red)
  statusBadgeFailed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,165,0,0.12)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  statusTextFailed: {
    marginLeft: rs(4),
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentOrange,
  },

  // ✅ NOT TAKEN
  statusBadgeNotTaken: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  statusTextNotTaken: {
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  scoreLabel: {
    fontSize: rf(13),
    color: COLORS.textSecondary,
    marginRight: rs(4),
  },

  scoreValue: {
    fontSize: rf(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  attemptsText: {
    fontSize: rf(12),
    color: COLORS.textSecondary,
    marginBottom: rs(12),
  },
  hrApprovalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rs(12),
    paddingTop: rs(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle, // ✅ fixed
  },

  hrApprovalLabel: {
    fontSize: rf(13),
    color: COLORS.textSecondary,
    marginRight: rs(8),
    fontWeight: '600',
  },

  // ✅ APPROVED
  hrApprovalBadgeApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,163,0.12)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  hrApprovalTextApproved: {
    marginLeft: rs(4),
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentGreen,
  },

  // ✅ REJECTED (use orange instead of harsh red)
  hrApprovalBadgeRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,165,0,0.12)',
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  hrApprovalTextRejected: {
    marginLeft: rs(4),
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.accentOrange,
  },

  // ✅ PENDING
  hrApprovalBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
  },

  hrApprovalTextPending: {
    marginLeft: rs(4),
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // ✅ Rejection message (softened, not aggressive red)
  hrRejectionReason: {
    fontSize: rf(11),
    color: COLORS.accentOrange,
    marginTop: rs(4),
    fontStyle: 'italic',
  },

  // ✅ PRIMARY BUTTON (same as training)
  startButton: {
    backgroundColor: COLORS.accentNavyBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: rs(12),
    borderRadius: rs(10),

    elevation: 1,
  },

  // ✅ Passed = green highlight
  startButtonPassed: {
    backgroundColor: COLORS.accentGreen,
  },

  startButtonText: {
    marginLeft: rs(8),
    fontSize: rf(15),
    fontWeight: '600',
    color: COLORS.white,
  },

  // ✅ MAIN CTA (match complete button)
  continueButton: {
    backgroundColor: COLORS.accentNavyBlue,
    padding: rs(16),
    borderRadius: rs(12),
    alignItems: 'center',
    marginTop: rs(24),

    elevation: 2,
  },

  continueButtonDisabled: {
    backgroundColor: COLORS.statusNeutral,
  },

  continueButtonText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.white,
  },

  bottomSpacer: {
    height: rs(16),
  },
});

export default TestsScreen;

