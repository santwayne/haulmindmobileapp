import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Image,
  InteractionManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp, CommonActions } from '@react-navigation/native';
import { profileService, FormattedDriverProfile } from '../../services/ProfileService';
import { apiService } from '../../services/api/apiService';
import { authManager } from '../../types/AuthManager';
import { notificationService } from '../../services/notificationService';
import { logger } from '../../utils/loggerHelper';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AuthService } from '../../navigation/AppNavigator';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

interface SettingsScreenProps {
  route?: any;
  navigation?: NavigationProp<RootStackParamList>;
  onLogout?: () => void;
}

const SettingsScreen = ({ route, navigation: navProp, onLogout }: SettingsScreenProps = {}) => {
  const navigation = navProp || useNavigation<NavigationProp<RootStackParamList>>();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [driverProfile, setDriverProfile] = useState<FormattedDriverProfile | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);


  // Password form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback form states
  const [feedbackType, setFeedbackType] = useState('General');
  const [feedbackText, setFeedbackText] = useState('');

  // Load profile data on component mount
  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async (forceRefresh = false) => {
    try {
      setIsLoadingProfile(true);
      const profile = await profileService.getProfile(forceRefresh);

      if (profile) {
        const formattedProfile = profileService.formatProfileForDisplay(profile);
        try {
          console.log('[SettingsScreen] Formatted profile:', JSON.stringify(formattedProfile));
        } catch (logError) {
          console.log('[SettingsScreen] Formatted profile (non-serializable)', formattedProfile);
        }
        setDriverProfile(formattedProfile);
      } else {
        Alert.alert(
          "Error",
          "Failed to load profile data. Please check your connection and try again.",
          [
            { text: "Retry", onPress: () => loadProfileData(true) },
            { text: "Cancel", style: "cancel" }
          ]
        );
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert("Error", "An unexpected error occurred while loading your profile.");
    } finally {
      setIsLoadingProfile(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProfileData(true);
  };

  const handleCheckUpdates = async () => {
    setIsUpdating(true);
    setUpdateStatus('Checking for updates...');

    // Simulate update check process
    setTimeout(() => {
      setUpdateStatus('Downloading updates...');
      setTimeout(() => {
        setUpdateStatus('Installing updates...');
        setTimeout(() => {
          setIsUpdating(false);
          setUpdateStatus('');
          Alert.alert(
            "Update Complete",
            "App has been updated to version 5.7.2026.FG\n\nNew Features:\n• Improved performance\n• Bug fixes\n• Enhanced security",
            [{ text: "OK", style: "default" }]
          );
        }, 2000);
      }, 2000);
    }, 2000);
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    console.log('🔐 handlePasswordSubmit called');
    console.log('Form state:', {
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword,
      hasConfirmPassword: !!confirmPassword
    });

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    try {
      setIsChangingPassword(true);
      logger.info('Changing password', {
        hasCurrentPassword: !!currentPassword,
        hasNewPassword: !!newPassword,
        newPasswordLength: newPassword.length
      });

      console.log('📞 Calling apiService.changePassword');
      const response = await apiService.changePassword(currentPassword, newPassword);
      console.log('✅ API response received:', {
        success: response.success,
        error: response.error,
        statusCode: response.statusCode
      });

      if (response.success) {
        logger.userAction('Password Changed', {}, 'SettingsScreen');

        // Reset loading state first
        setIsChangingPassword(false);

        // Close modal and reset form immediately
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Show success alert after interactions complete (ensuring modal has closed)
        InteractionManager.runAfterInteractions(() => {
          Alert.alert(
            "Success",
            "Password changed successfully!\nYou will be logged out for security.",
            [
              {
                text: "OK",
                onPress: async () => {
                  // Logout user after alert is dismissed
                  await handleLogout();
                }
              }
            ]
          );
        });
      } else {
        const errorMsg = response.error || "Failed to change password. Please try again.";
        logger.error('Password change failed', { error: errorMsg, statusCode: response.statusCode });
        setIsChangingPassword(false);
        Alert.alert("Error", errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Exception in handlePasswordSubmit:', error);
      logger.error('Error changing password', error);
      setIsChangingPassword(false);
      Alert.alert(
        "Error",
        error?.message || "An unexpected error occurred. Please try again."
      );
    }
  };

  const handleSendFeedback = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      Alert.alert("Error", "Please enter your feedback");
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      logger.info('Submitting feedback', { type: feedbackType });

      const response = await apiService.submitFeedback(feedbackType, feedbackText);

      if (response.success) {
        const ticketId = response.data?.ticketId || `#FB${Date.now().toString().slice(-6)}`;
        Alert.alert(
          "Feedback Sent",
          `Thank you for your ${feedbackType.toLowerCase()} feedback!\n\nTicket ID: ${ticketId}\n\nWe'll review it within 24-48 hours.`,
          [{ text: "OK", onPress: () => setShowFeedbackModal(false) }]
        );

        // Reset form
        setFeedbackText('');
        setFeedbackType('General');
      } else {
        Alert.alert("Error", response.error || "Failed to submit feedback. Please try again.");
      }
    } catch (error: any) {
      logger.error('Error submitting feedback', error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Call API logout
              try {
                await apiService.logout();
              } catch (apiError) {
                // Log but don't fail - we'll logout locally anyway
                logger.error('API logout error (continuing with local logout)', apiError);
              }

              // Clear auth data
              await authManager.logout();
              await AuthService.clearAuth();

              logger.userAction('Logout', {}, 'SettingsScreen');

              // Navigate to login screen
              // Use the onLogout callback if provided (preferred method)
              if (onLogout && typeof onLogout === 'function') {
                onLogout();
              } else {
                // Fallback: Try to get root navigator and reset to Login
                try {
                  // Get the root navigator
                  const rootNavigation = (navigation as any).getParent?.() || navigation;
                  rootNavigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    })
                  );
                } catch (navError) {
                  logger.error('Navigation error during logout', navError);
                  // If navigation fails, the AppNavigator should handle it via auth state
                  // But we can try a simple navigate as last resort
                  try {
                    (navigation as any).navigate('Login');
                  } catch (finalError) {
                    logger.error('Final navigation fallback failed', finalError);
                  }
                }
              }
            } catch (error: any) {
              logger.error('Error during logout', error);
              // Still logout locally even if something fails
              try {
                await authManager.logout();
                await AuthService.clearAuth();
                // Try to navigate to login using onLogout or navigation
                if (onLogout && typeof onLogout === 'function') {
                  onLogout();
                } else {
                  try {
                    const rootNavigation = (navigation as any).getParent?.() || navigation;
                    rootNavigation.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                      })
                    );
                  } catch (navError) {
                    // Last resort: try simple navigate
                    (navigation as any).navigate('Login');
                  }
                }
              } catch (fallbackError) {
                logger.error('Error during fallback logout', fallbackError);
                Alert.alert('Error', 'Failed to logout completely. Please restart the app.');
              }
            }
          }
        }
      ]
    );
  };

  const renderPasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (!isChangingPassword) {
          setShowPasswordModal(false);
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            {!isChangingPassword && (
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Current Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable={!isChangingPassword}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!isChangingPassword}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!isChangingPassword}
            autoCapitalize="none"
            onSubmitEditing={handlePasswordSubmit}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => {
                if (!isChangingPassword) {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
              disabled={isChangingPassword}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.submitBtn, isChangingPassword && styles.disabledBtn]}
              onPress={handlePasswordSubmit}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderFeedbackModal = () => (
    <Modal
      visible={showFeedbackModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Send Feedback</Text>

          <Text style={styles.label}>Feedback Type</Text>
          <View style={styles.feedbackTypes}>
            {['General', 'Bug Report', 'Feature Request', 'Complaint'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeBtn,
                  feedbackType === type && styles.selectedType
                ]}
                onPress={() => setFeedbackType(type)}
              >
                <Text style={[
                  styles.typeBtnText,
                  feedbackType === type && styles.selectedTypeText
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.textArea}
            placeholder="Describe your feedback, problem, or feature request..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
            value={feedbackText}
            onChangeText={setFeedbackText}
            textAlignVertical="top"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setShowFeedbackModal(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.submitBtn, isSubmittingFeedback && styles.disabledBtn]}
              onPress={handleFeedbackSubmit}
              disabled={isSubmittingFeedback}
            >
              {isSubmittingFeedback ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Send Feedback</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderDriverInfo = () => {
    if (isLoadingProfile) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      );
    }

    if (!driverProfile) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile data</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadProfileData(true)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Current Driver</Text>
          <Text style={styles.value}>{driverProfile.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{driverProfile.email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{driverProfile.phone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Country</Text>
          <Text style={styles.value}>{driverProfile.country}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, styles.statusActive]}>
            {driverProfile.status?.toUpperCase() || 'ACTIVE'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Member Since</Text>
          <Text style={styles.value}>{driverProfile.memberSince}</Text>
        </View>
      </View>
    );
  };

  const renderCompanyInfo = () => {
    if (isLoadingProfile) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading company info...</Text>
        </View>
      );
    }

    const company = driverProfile?.company;
    const formatField = (value?: string) => (value && value.trim().length > 0 ? value : 'Not available');

    if (!company) {
      return (
        <View style={styles.card}>
          <Text style={styles.noDataText}>No company information available</Text>
        </View>
      );
    }

    const companyRows = [
      { label: 'Company Name', value: company.name && company.name.trim().length > 0 ? company.name : 'Not assigned' },
      { label: 'Company Code', value: formatField(company.code) },
      { label: 'Contact Email', value: formatField(company.contactEmail) },
      { label: 'Contact Phone', value: formatField(company.contactPhone) },
      { label: 'Address', value: formatField(company.address) },
    ];

    return (
      <View style={styles.card}>
        {companyRows.map(({ label, value }) => (
          <View style={styles.row} key={label}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile Hero */}
        {driverProfile && (
          <View style={styles.profileHero}>
            <View style={styles.profileAvatarWrapper}>
              {driverProfile.profileImage ? (
                <Image
                  source={{ uri: driverProfile.profileImage }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <Text style={styles.profileAvatarInitials}>
                    {driverProfile.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
              )}
              <View style={[
                styles.profileStatusDot,
                { backgroundColor: driverProfile.status === 'active' ? '#10B981' : '#9CA3AF' }
              ]} />
            </View>
            <Text style={styles.profileHeroName}>{driverProfile.name}</Text>
            <Text style={styles.profileHeroEmail}>{driverProfile.email}</Text>
            <View style={[
              styles.profileStatusBadge,
              { backgroundColor: driverProfile.status === 'active' ? '#D1FAE5' : '#F3F4F6' }
            ]}>
              <Text style={[
                styles.profileStatusBadgeText,
                { color: driverProfile.status === 'active' ? '#065F46' : '#6B7280' }
              ]}>
                {driverProfile.status?.toUpperCase() || 'ACTIVE'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionBtn, isUpdating && styles.disabledBtn]}
            onPress={handleCheckUpdates}
            disabled={isUpdating}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="refresh" size={24} color={COLORS.accentBlue} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Check for Updates</Text>
                <Text style={styles.actionSubtitle}>
                  {updateStatus || "Refresh and synchronize data"}
                </Text>
              </View>
              {isUpdating ? (
                <ActivityIndicator size="small" color={COLORS.accentNavyBlue} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#999" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="lock-closed" size={24} color={COLORS.accentGreen} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Change Password</Text>
                <Text style={styles.actionSubtitle}>Update your account password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleSendFeedback}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.accentOrange} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Send Feedback</Text>
                <Text style={styles.actionSubtitle}>
                  Share your feedback or report issues
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Debug Section */}
        {/* <Text style={styles.sectionTitle}>Debug</Text> */}
        {/* <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CrashLogs' as never)}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="bug" size={24} color="#F59E0B" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>View Crash Logs</Text>
                <Text style={styles.actionSubtitle}>View app crash logs and errors</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>






        </View> */}

        {/* Logout Section */}
        {/* <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.logoutBtn]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="log-out" size={24} color="#EF4444" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionTitle, styles.logoutText]}>Logout</Text>
                <Text style={styles.actionSubtitle}>Sign out of your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View> */}

        {/* Driver Info */}
        <Text style={styles.sectionTitle}>Driver Information</Text>
        {renderDriverInfo()}

        {/* Company Info */}
        <Text style={styles.sectionTitle}>Company Information</Text>
        {renderCompanyInfo()}



        {renderPasswordModal()}
        {renderFeedbackModal()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  header: {
    backgroundColor: COLORS.bgCardLight,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  profileHero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: COLORS.bgCardLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  profileAvatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  profileAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.accentNavyBlue,
  },
  profileAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#DDD6FE',
  },
  profileAvatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  profileStatusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileHeroName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  profileHeroEmail: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  profileStatusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  profileStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionsSection: {
    backgroundColor: COLORS.bgCardLight,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBtn: {
    backgroundColor: COLORS.bgCardLight,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  logoutBtn: {
    borderBottomWidth: 0,
  },
  actionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,

    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  logoutText: {
    color: '#EF4444',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  card: {
    backgroundColor: COLORS.bgCardLight,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  label: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },
  value: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  statusActive: {
    color: '#28a745',
    fontWeight: 'bold',
  },

  // Loading states
  loadingContainer: {
    backgroundColor: COLORS.bgMain,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.accentNavyBlue,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#fff',
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 12,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: COLORS.bgCardLight,
    color: COLORS.textPrimary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
    height: 100,
    backgroundColor: COLORS.bgCardLight,
    color: COLORS.textPrimary,
  },
  feedbackTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    marginTop: 5,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedType: {
    backgroundColor: COLORS.accentNavyBlue,
    borderColor: COLORS.accentNavyBlue,
  },
  typeBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  selectedTypeText: {
    color: COLORS.white,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelBtn: {
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  submitBtn: {
    backgroundColor: COLORS.accentNavyBlue,
  },
  cancelBtnText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  submitBtnText: {
    textAlign: 'center',
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default SettingsScreen;