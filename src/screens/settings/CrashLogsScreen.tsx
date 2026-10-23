import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { crashReporter, CrashLog } from '../../utils/crashReporter';
import { COLORS } from '../../theme';

const CrashLogsScreen: React.FC = () => {
  const [crashLogs, setCrashLogs] = useState<CrashLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<CrashLog | null>(null);

  useEffect(() => {
    loadCrashLogs();
  }, []);

  const loadCrashLogs = async () => {
    try {
      setLoading(true);
      const logs = await crashReporter.getCrashLogs();
      const validLogs = (logs || []).filter((log: any) => {
        return log &&
               typeof log === 'object' &&
               log.timestamp &&
               log.error &&
               typeof log.error === 'object' &&
               log.platform;
      });
      setCrashLogs(validLogs);
    } catch (error) {
      console.error('Failed to load crash logs:', error);
      Alert.alert('Error', 'Failed to load crash logs');
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Crash Logs',
      'Are you sure you want to delete all crash logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await crashReporter.clearCrashLogs();
            setCrashLogs([]);
            Alert.alert('Success', 'Crash logs cleared');
          },
        },
      ]
    );
  };

  const handleExportLogs = async () => {
    try {
      const logsText = await crashReporter.getCrashLogsAsText();
      const exportData = await crashReporter.exportCrashLogs();

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message: exportData,
          title: 'Crash Logs Export',
        });
      } else {
        Alert.alert('Export', `Logs exported:\n\n${logsText.substring(0, 500)}...`);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
      Alert.alert('Error', 'Failed to export crash logs');
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.accentNavyBlue} />
          <Text style={styles.loadingText}>Loading crash logs...</Text>
        </View>
      </View>
    );
  }

  if (crashLogs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="bug-outline" size={48} color={COLORS.accentOrange} />
          </View>
          <Text style={styles.emptyText}>No Crash Logs</Text>
          <Text style={styles.emptySubtext}>
            If the app is crashing, logs may not be saved in time.
          </Text>
          <Text style={[styles.emptySubtext, { marginTop: 16 }]}>
            Native crashes terminate the app before logs can be saved.
          </Text>

          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Check console logs via:</Text>
            <Text style={styles.hintItem}>• Remote Debugging (Chrome DevTools)</Text>
            <Text style={styles.hintItem}>• ADB Logcat (adb logcat)</Text>
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={async () => {
              // Only call logCrash once to avoid duplicate saves and alerts
              const testError = new Error('TEST: Crash reporter is working');
              await crashReporter.logCrash(testError, 'CrashLogsScreen', { test: true });
              loadCrashLogs();
            }}
          >
            <Ionicons name="flask-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.testButtonText}>Test Crash Reporter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bug" size={20} color={COLORS.accentRed} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Crash Logs</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{crashLogs.length}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleExportLogs}>
            <Ionicons name="share-outline" size={18} color={COLORS.accentNavyBlue} />
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClearLogs}>
            <Ionicons name="trash-outline" size={18} color={COLORS.accentRed} />
            <Text style={[styles.actionButtonText, styles.clearButtonText]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.logsList} showsVerticalScrollIndicator={false}>
        {crashLogs.map((log, index) => (
          <TouchableOpacity
            key={index}
            style={styles.logCard}
            onPress={() => setSelectedLog(log)}
            activeOpacity={0.7}
          >
            <View style={styles.logHeader}>
              <View style={styles.logIconContainer}>
                <Ionicons name="bug" size={18} color={COLORS.accentRed} />
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logComponent}>{log?.component || 'Unknown'}</Text>
                <Text style={styles.logTime}>{log?.timestamp ? formatDate(log.timestamp) : 'Unknown time'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.logMessage} numberOfLines={2}>
              {log?.error?.message || 'No error message available'}
            </Text>
            <View style={styles.logFooter}>
              <View style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>{log?.platform || 'Unknown'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Detail Modal */}
      {selectedLog && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="bug" size={18} color={COLORS.accentRed} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Crash Details</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedLog(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>
                  {selectedLog?.timestamp ? formatDate(selectedLog.timestamp) : 'Unknown'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Component</Text>
                <Text style={styles.detailValue}>{selectedLog?.component || 'Unknown'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Platform</Text>
                <Text style={styles.detailValue}>{selectedLog?.platform || 'Unknown'}</Text>
              </View>

              {selectedLog?.error && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Error Name</Text>
                    <Text style={[styles.detailValue, { color: COLORS.accentRed }]}>
                      {selectedLog.error?.name || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Error Message</Text>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeText}>{selectedLog.error?.message || 'No error message available'}</Text>
                    </View>
                  </View>
                  {selectedLog.error?.stack && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Stack Trace</Text>
                      <ScrollView style={styles.stackTrace} nestedScrollEnabled>
                        <Text style={styles.stackTraceText}>{selectedLog.error.stack}</Text>
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {!selectedLog?.error && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Error</Text>
                  <Text style={styles.detailValue}>Error information is missing or corrupted</Text>
                </View>
              )}

              {selectedLog?.additionalData && Object.keys(selectedLog.additionalData).length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Additional Data</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>
                      {JSON.stringify(selectedLog.additionalData, null, 2)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeModalButton} onPress={() => setSelectedLog(null)}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  hintBox: {
    marginTop: 20,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    borderRadius: 10,
    padding: 14,
    width: '100%',
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  hintItem: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginTop: 4,
  },
  testButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentNavyBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.bgCardLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: COLORS.accentRed,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  clearButton: {
    borderColor: COLORS.accentRed,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accentNavyBlue,
  },
  clearButtonText: {
    color: COLORS.accentRed,
  },

  // Log list
  logsList: {
    flex: 1,
    padding: 16,
  },
  logCard: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logInfo: {
    flex: 1,
  },
  logComponent: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  logFooter: {
    flexDirection: 'row',
  },
  platformBadge: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  platformBadgeText: {
    fontSize: 11,
    color: COLORS.accentNavyBlue,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: 420,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bgCardLight,
  },
  detailSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bgCardLight,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'right',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  codeBox: {
    backgroundColor: COLORS.bgMain,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  codeText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    lineHeight: 18,
  },
  stackTrace: {
    backgroundColor: COLORS.bgMain,
    borderRadius: 8,
    padding: 10,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: COLORS.accentNavyBlue,
  },
  stackTraceText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    lineHeight: 16,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.accentNavyBlue,
  },
  closeModalButton: {
    backgroundColor: COLORS.accentNavyBlue,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CrashLogsScreen;
