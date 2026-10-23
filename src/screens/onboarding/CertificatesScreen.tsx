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
import { useNavigation } from '@react-navigation/native';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';

interface Certificate {
  id: string;
  certificateName: string;
  verificationType: TestType;
  expiryDate?: string;
  status: 'active' | 'expired' | 'missing';
}

const CertificatesScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [allRequiredPresent, setAllRequiredPresent] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      
      // Mock data
      const mockCertificates: Certificate[] = [
        {
          id: '1',
          certificateName: 'TDG Certificate',
          verificationType: 'TDG',
          expiryDate: '2025-12-31',
          status: 'active',
        },
        {
          id: '2',
          certificateName: 'Vehicle Inspection Certificate',
          verificationType: 'VEHICLE',
          status: 'missing',
        },
        {
          id: '3',
          certificateName: 'HOS Compliance Certificate',
          verificationType: 'HOS',
          expiryDate: '2024-06-15',
          status: 'expired',
        },
        {
          id: '4',
          certificateName: 'Winter Driving Certificate',
          verificationType: 'WINTER',
          expiryDate: '2025-03-31',
          status: 'active',
        },
      ];

      setCertificates(mockCertificates);
      
      // Check if all required certificates are present and valid
      const requiredTypes: TestType[] = ['TDG', 'VEHICLE', 'HOS'];
      const requiredCerts = requiredTypes.map(type => 
        mockCertificates.find(c => c.verificationType === type)
      );
      const allPresent = requiredCerts.every(cert => cert && cert.status === 'active');
      setAllRequiredPresent(allPresent);
    } catch (error) {
      console.error('Error fetching certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!allRequiredPresent) {
      Alert.alert(
        'Certificates Incomplete',
        'Required certificate missing. Upload and get HR approval to continue.',
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

  const requiredTypes: TestType[] = ['TDG', 'VEHICLE', 'HOS'];
  const hasMissingRequired = requiredTypes.some(type => {
    const cert = certificates.find(c => c.verificationType === type);
    return !cert || cert.status !== 'active';
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading certificates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Certificates</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning if certificates missing */}
        {hasMissingRequired && (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Required Certificate Missing</Text>
              <Text style={styles.warningText}>
                Upload and get HR approval to continue. Trips are still locked.
              </Text>
            </View>
          </View>
        )}

        {/* Certificates List */}
        {requiredTypes.map((type) => {
          const cert = certificates.find(c => c.verificationType === type);
          
          return (
            <View key={type} style={styles.certificateCard}>
              <View style={styles.certificateHeader}>
                <View
                  style={[
                    styles.verificationTypeBadge,
                    { backgroundColor: getTestTypeColor(type) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationTypeText,
                      { color: getTestTypeColor(type) },
                    ]}
                  >
                    {getTestTypeLabel(type)}
                  </Text>
                </View>
                {cert && (
                  <View
                    style={[
                      styles.statusBadge,
                      cert.status === 'active' && styles.statusBadgeActive,
                      cert.status === 'expired' && styles.statusBadgeExpired,
                      cert.status === 'missing' && styles.statusBadgeMissing,
                    ]}
                  >
                    {cert.status === 'active' && (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.statusTextActive}>Active ✅</Text>
                      </>
                    )}
                    {cert.status === 'expired' && (
                      <>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                        <Text style={styles.statusTextExpired}>Expired ❌</Text>
                      </>
                    )}
                    {cert.status === 'missing' && (
                      <>
                        <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                        <Text style={styles.statusTextMissing}>Missing ⚠️</Text>
                      </>
                    )}
                  </View>
                )}
                {!cert && (
                  <View style={[styles.statusBadge, styles.statusBadgeMissing]}>
                    <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                    <Text style={styles.statusTextMissing}>Missing ⚠️</Text>
                  </View>
                )}
              </View>
              
              {cert ? (
                <>
                  <Text style={styles.certificateName}>{cert.certificateName}</Text>
                  {cert.expiryDate && (
                    <Text style={styles.expiryDate}>
                      Expiry: {new Date(cert.expiryDate).toLocaleDateString()}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.missingText}>
                  No certificate uploaded for {getTestTypeLabel(type)}
                </Text>
              )}
            </View>
          );
        })}

        {/* Optional Certificates */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Optional Certificates</Text>
        </View>
        
        {certificates
          .filter(c => !requiredTypes.includes(c.verificationType))
          .map((cert) => (
            <View key={cert.id} style={styles.certificateCard}>
              <View style={styles.certificateHeader}>
                <View
                  style={[
                    styles.verificationTypeBadge,
                    { backgroundColor: getTestTypeColor(cert.verificationType) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationTypeText,
                      { color: getTestTypeColor(cert.verificationType) },
                    ]}
                  >
                    {getTestTypeLabel(cert.verificationType)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    cert.status === 'active' && styles.statusBadgeActive,
                    cert.status === 'expired' && styles.statusBadgeExpired,
                  ]}
                >
                  {cert.status === 'active' && (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.statusTextActive}>Active ✅</Text>
                    </>
                  )}
                  {cert.status === 'expired' && (
                    <>
                      <Ionicons name="close-circle" size={16} color="#EF4444" />
                      <Text style={styles.statusTextExpired}>Expired ❌</Text>
                    </>
                  )}
                </View>
              </View>
              <Text style={styles.certificateName}>{cert.certificateName}</Text>
              {cert.expiryDate && (
                <Text style={styles.expiryDate}>
                  Expiry: {new Date(cert.expiryDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))}

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !allRequiredPresent && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!allRequiredPresent}
        >
          <Text style={styles.continueButtonText}>
            {allRequiredPresent ? 'Continue to HR Approval →' : 'Trips Still Locked'}
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
    backgroundColor: '#F3F4F6',
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
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  certificateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  certificateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verificationTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verificationTypeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeMissing: {
    backgroundColor: '#FEF3C7',
  },
  statusTextActive: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  statusTextExpired: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  statusTextMissing: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  certificateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  expiryDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  missingText: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: '#0ea3d8',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 16,
  },
});

export default CertificatesScreen;

