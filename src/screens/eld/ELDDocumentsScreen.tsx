import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

interface ELDDocument {
  _id: string;
  fileName: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export default function ELDDocumentsScreen() {
  const [documents, setDocuments] = useState<ELDDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchELDDocuments();
  }, []);

  const fetchELDDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getELDDocuments();

      if (response.success && response.data) {
        setDocuments(Array.isArray(response.data) ? response.data : response.data.data || []);
      } else {
        setDocuments([]);
        logger.warn('No ELD documents found or error occurred', response);
      }
    } catch (error: any) {
      logger.error('Error fetching ELD documents', error);
      Alert.alert('Error', 'Failed to load ELD documents. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchELDDocuments();
  };

  const handleViewDocument = async (document: ELDDocument) => {
    try {
      logger.info('Opening ELD document for viewing', { documentId: document._id, fileName: document.fileName });

      // Always get a fresh signed URL - never reuse old URLs to prevent expiration
      const response = await apiService.getELDDocumentSignedUrl(document._id, 'inline');

      if (response.success && response.data?.url) {
        const signedUrl = response.data.url;
        logger.info('Got fresh signed URL for viewing', {
          url: signedUrl.substring(0, 100) + '...',
          expiresIn: response.data.expiresIn
        });

        // Check if URL is valid before trying to open
        if (!signedUrl || signedUrl.length === 0) {
          Alert.alert('Error', 'Invalid document URL. Please try again.');
          return;
        }

        const canOpen = await Linking.canOpenURL(signedUrl);
        if (canOpen) {
          // Open URL immediately - should display inline in browser
          await Linking.openURL(signedUrl);
        } else {
          Alert.alert('Error', 'Cannot open this document. Please try downloading it instead.');
        }
      } else {
        logger.error('Failed to get signed URL', response);
        const errorMessage = response?.error || response?.message || 'Failed to open document. Please try again.';
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      logger.error('Error opening ELD document', error);
      const errorMessage = error?.message || 'Failed to open document. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDownloadDocument = async (document: ELDDocument) => {
    try {
      const response = await apiService.getELDDocumentSignedUrl(document._id, 'attachment');

      if (response.success && response.data?.url) {
        const canOpen = await Linking.canOpenURL(response.data.url);
        if (canOpen) {
          await Linking.openURL(response.data.url);
        } else {
          Alert.alert('Error', 'Cannot download this document.');
        }
      } else {
        Alert.alert('Error', 'Failed to download document. Please try again.');
      }
    } catch (error: any) {
      logger.error('Error downloading ELD document', error);
      Alert.alert('Error', 'Failed to download document. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ELD Documents</Text>
        <Text style={styles.headerSubtitle}>Access your Electronic Logging Device documents</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      ) : documents.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No ELD Documents</Text>
          <Text style={styles.emptySubtitle}>
            No ELD documents are currently available. Contact your HR team for more information.
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
          {documents.map((doc) => (
            <View key={doc._id} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentIconContainer}>
                  <Ionicons name="document-text" size={24} color="#0ea3d8" />
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentTitle} numberOfLines={2}>
                    {doc.title || doc.fileName}
                  </Text>
                  {doc.description && (
                    <Text style={styles.documentDescription} numberOfLines={2}>
                      {doc.description}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.documentActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton]}
                  onPress={() => handleViewDocument(doc)}
                >
                  <Ionicons name="eye-outline" size={20} color="#0ea3d8" />
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.downloadButton]}
                  onPress={() => handleDownloadDocument(doc)}
                >
                  <Ionicons name="download-outline" size={20} color="#10B981" />
                  <Text style={styles.downloadButtonText}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
    borderBottomColor: COLORS.borderGlow,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
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
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  documentCard: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGlow,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewButton: {
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea3d8',
  },
  downloadButton: {
    backgroundColor: COLORS.accentGreen,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
});


