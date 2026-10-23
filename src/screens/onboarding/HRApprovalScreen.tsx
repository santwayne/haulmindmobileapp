import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
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

type OnboardingStatus = 'PENDING_TESTS' | 'IN_PROGRESS' | 'WAITING_FOR_HR_APPROVAL' | 'APPROVED' | 'REJECTED';

interface HRApprovalScreenProps {
  onLogout?: () => void;
}

const HRApprovalScreen = ({ onLogout }: HRApprovalScreenProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus>('WAITING_FOR_HR_APPROVAL');
  const [submittedDate, setSubmittedDate] = useState<string>('');
  const [allTestsApproved, setAllTestsApproved] = useState(false);

  useEffect(() => {
    fetchApprovalStatus();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchApprovalStatus();
    }, [])
  );

  const fetchApprovalStatus = async () => {
    try {
      setLoading(true);

      // Get driver ID from storage
      const userDataStr = await AsyncStorage.getItem('user_data') ||
        await AsyncStorage.getItem('@fleetgo_user_data') ||
        await AsyncStorage.getItem('userData');

      if (!userDataStr) {
        console.error('❌ No user data found');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const userData = JSON.parse(userDataStr);
      const driverId = userData._id || userData.id || userData.userId;

      if (!driverId) {
        console.error('❌ No driver ID found');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('📋 Fetching HR approval status for driver:', driverId);

      // Call backend API
      const response = await apiService.getDriverOnboardingStatus(driverId);

      console.log('📋 HR Approval response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        const data = response.data.data || response.data;

        // Map backend status to local status
        let mappedStatus: OnboardingStatus = 'WAITING_FOR_HR_APPROVAL';

        if (data.allTestsApprovedByHR || data.hrApprovalStatus === 'APPROVED') {
          mappedStatus = 'APPROVED';
          setAllTestsApproved(true);
        } else if (data.hrApprovalStatus === 'REJECTED') {
          mappedStatus = 'REJECTED';
        } else if (data.hrApprovalStatus === 'IN_REVIEW' || data.onboardingStatus === 'AWAITING_HR_APPROVAL') {
          mappedStatus = 'WAITING_FOR_HR_APPROVAL';
        }

        setStatus(mappedStatus);

        // Set submitted date from tests completed date or onboarding status
        if (data.testsCompleted && data.tests) {
          const completedTests = data.tests.filter((t: any) => t.passed);
          if (completedTests.length > 0) {
            // Use the latest test completion date
            const latestTest = completedTests[completedTests.length - 1];
            setSubmittedDate(new Date().toISOString()); // Use current date as fallback
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching approval status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchApprovalStatus();
  };

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    }
  };

  if (loading && !submittedDate) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading approval status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isPending = status === 'WAITING_FOR_HR_APPROVAL';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* HEADER (same as other screens) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={ri(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HR Approval</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >

        {/* STATUS CARD (converted to contentCard style) */}
        <View style={styles.contentCard}>

          {/* APPROVED */}
          {isApproved && (
            <>
              <View style={styles.contentIconContainer}>
                <Ionicons name="checkmark-circle" size={ri(40)} color={COLORS.accentGreen} />
              </View>

              <View style={styles.contentInfo}>
                <Text style={styles.contentName}>Approved</Text>
                <Text style={styles.contentDescription}>
                  Congratulations! Your onboarding has been approved. You now have full access to the app.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.completeButton}
                onPress={() => {
                  navigation.navigate('MainTabs', { screen: 'Dashboard' });
                }}
              >
                <Text style={styles.completeButtonText}>Go to Dashboard →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* REJECTED */}
          {isRejected && (
            <>
              <View style={styles.contentIconContainer}>
                <Ionicons name="close-circle" size={ri(40)} color={COLORS.accentOrange} />
              </View>

              <View style={styles.contentInfo}>
                <Text style={styles.contentName}>Rejected</Text>
                <Text style={styles.contentDescription}>
                  Your onboarding was rejected. Please contact HR to correct the required details.
                </Text>
              </View>

              <View style={styles.viewedBadge}>
                <Ionicons name="mail-outline" size={ri(16)} color={COLORS.textSecondary} />
                <Text style={styles.viewedText}>Contact HR</Text>
              </View>
            </>
          )}

          {/* PENDING */}
          {isPending && (
            <>
              <View style={styles.contentIconContainer}>
                <Ionicons name="time-outline" size={ri(40)} color={COLORS.accentBlue} />
              </View>

              <View style={styles.contentInfo}>
                <Text style={styles.contentName}>Pending Approval</Text>
                <Text style={styles.contentDescription}>
                  Your documents are under review. You will be notified once HR completes verification.
                </Text>

                {submittedDate && (
                  <Text style={[styles.contentType, { marginTop: rs(6) }]}>
                    Submitted: {new Date(submittedDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* INFO CARD (same style as instruction banner) */}
        <View style={styles.instructionsCard}>
          <Ionicons name="information-circle" size={ri(24)} color={COLORS.accentBlue} />
          <Text style={styles.instructionsText}>
            {isPending && 'HR typically reviews submissions within 1–2 business days.'}
            {isApproved && 'You now have full access to features like trips, mileage tracking, and documents.'}
            {isRejected && 'Please review requirements and resubmit your documents. Contact HR if needed.'}
          </Text>
        </View>

        {/* ACTIONS */}
        <View style={{ marginTop: rs(16), gap: rs(12) }}>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.viewButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={ri(16)} color={COLORS.white} />
            <Text style={styles.viewButtonText}>Refresh Status</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.viewButton, { backgroundColor: COLORS.statusNeutral }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={ri(16)} color={COLORS.white} />
            <Text style={styles.viewButtonText}>Logout</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain, // ✅ fixed (was grey)
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
  contentCard: {
  backgroundColor: COLORS.bgCard,
  borderRadius: rs(12),
  padding: rs(16),
  marginBottom: rs(16),

  borderWidth: 1,
  borderColor: COLORS.borderSubtle,

  elevation: 2,
},

contentIconContainer: {
  width: rs(60),
  height: rs(60),
  borderRadius: rs(30),
  backgroundColor: COLORS.bgCardLight,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'center',
  marginBottom: rs(12),
},

contentInfo: {
  alignItems: 'center',
},

contentName: {
  fontSize: rf(18),
  fontWeight: '700',
  color: COLORS.textPrimary,
  marginBottom: rs(6),
  textAlign: 'center',
},

contentDescription: {
  fontSize: rf(14),
  color: COLORS.textSecondary,
  textAlign: 'center',
  lineHeight: rf(20),
},

contentType: {
  fontSize: rf(12),
  color: COLORS.textSecondary,
},

// ✅ BUTTON (same as training)
viewButton: {
  backgroundColor: COLORS.accentNavyBlue,
  paddingVertical: rs(14),
  borderRadius: rs(10),
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: rs(6),
},

viewButtonText: {
  fontSize: rf(14),
  fontWeight: '600',
  color: COLORS.white,
},

completeButton: {
  backgroundColor: COLORS.accentNavyBlue,
  padding: rs(16),
  borderRadius: rs(12),
  alignItems: 'center',
  marginTop: rs(16),
},

completeButtonText: {
  fontSize: rf(16),
  fontWeight: '700',
  color: COLORS.white,
},

// ✅ INFO / INSTRUCTION CARD
instructionsCard: {
  flexDirection: 'row',
  backgroundColor: 'rgba(0,209,255,0.08)',
  padding: rs(16),
  borderRadius: rs(12),
  marginBottom: rs(16),
  borderLeftWidth: 3,
  borderLeftColor: COLORS.accentBlue,
},

instructionsText: {
  flex: 1,
  marginLeft: rs(12),
  fontSize: rf(14),
  color: COLORS.textSecondary,
  lineHeight: rf(20),
},

// ✅ SMALL BADGE (for rejected contact)
viewedBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: rs(12),
},

viewedText: {
  marginLeft: rs(6),
  fontSize: rf(13),
  color: COLORS.textSecondary,
},

  // ✅ HEADER (match training screen)
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
    padding: rs(8),
  },

  headerTitle: {
    fontSize: rf(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  placeholder: {
    width: rs(40),
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: rs(16),
    paddingBottom: Platform.OS === 'android' ? rs(80) : rs(32),
    paddingTop: rs(16),
  },

  // ❌ REMOVE statusCard → we now use contentCard
  // but if still needed, convert it:

  statusCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: rs(12),
    padding: rs(20),
    alignItems: 'center',
    marginBottom: rs(16),

    borderWidth: 1,
    borderColor: COLORS.borderSubtle,

    elevation: 2,
  },

  // ✅ ICON CONTAINERS (match training cards)
  approvedIconContainer: {
    marginBottom: rs(12),
  },

  rejectedIconContainer: {
    marginBottom: rs(12),
  },

  pendingIconContainer: {
    marginBottom: rs(12),
  },

  // ✅ TITLE (consistent typography)
  statusTitle: {
    fontSize: rf(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: rs(12),
    textAlign: 'center',
  },

  // ✅ MESSAGE TEXT
  statusMessage: {
    fontSize: rf(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: rf(20),
    marginBottom: rs(16),
  },
  submittedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rs(12),
  },

  submittedText: {
    marginLeft: rs(8),
    fontSize: rf(13),
    color: COLORS.textSecondary,
  },

  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rs(12),
    padding: rs(12),
    backgroundColor: COLORS.bgCardLight, // ✅ fixed
    borderRadius: rs(10),
  },

  contactText: {
    marginLeft: rs(8),
    fontSize: rf(13),
    color: COLORS.textSecondary,
  },

  // ✅ PRIMARY CTA (same as training complete button)
  continueButton: {
    backgroundColor: COLORS.accentNavyBlue,
    paddingHorizontal: rs(24),
    paddingVertical: rs(14),
    borderRadius: rs(12),
    marginTop: rs(16),
    alignItems: 'center',

    elevation: 2,
  },

  continueButtonText: {
    fontSize: rf(16),
    fontWeight: '700',
    color: COLORS.white,
  },

  // ✅ INFO CARD → SAME AS instructionsCard (reuse system)
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,209,255,0.08)', // ✅ match instructions
    padding: rs(16),
    borderRadius: rs(12),
    marginBottom: rs(16),
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentBlue,
  },

  infoContent: {
    flex: 1,
    marginLeft: rs(12),
  },

  infoTitle: {
    fontSize: rf(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: rs(6),
  },

  infoText: {
    fontSize: rf(14),
    color: COLORS.textSecondary,
    lineHeight: rf(20),
  },

  actionsContainer: {
    gap: rs(12),
  },

  // ✅ SECONDARY BUTTON (outline style)
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    padding: rs(14),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
  },

  refreshButtonText: {
    marginLeft: rs(8),
    fontSize: rf(14),
    fontWeight: '600',
    color: COLORS.accentBlue,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard, // ✅ match system
    padding: rs(14),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: COLORS.accentOrange, // ✅ use system color
  },

  logoutButtonText: {
    marginLeft: rs(8),
    fontSize: rf(14),
    fontWeight: '600',
    color: COLORS.accentOrange,
  },

  bottomSpacer: {
    height: rs(16),
  },
});

export default HRApprovalScreen;

