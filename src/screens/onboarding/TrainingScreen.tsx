import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../../services/api/apiService';
import { COLORS, rs, rf, ri } from '../../theme';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';
type ContentType = 'PDF' | 'IMAGE' | 'VIDEO';

interface TrainingContent {
  id: string;
  name: string;
  type: ContentType;
  testType: TestType;
  viewed: boolean;
  fileUrl?: string;
  fileName?: string;
  description?: string;
}

const TrainingScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [trainingContent, setTrainingContent] = useState<TrainingContent[]>([]);
  const [trainingCompleted, setTrainingCompleted] = useState(false);
  const [viewedContent, setViewedContent] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTrainingContent();
    loadViewedContent();
  }, []);

  const loadViewedContent = async () => {
    try {
      const viewed = await AsyncStorage.getItem('viewedTrainingContent');
      if (viewed) {
        setViewedContent(new Set(JSON.parse(viewed)));
      }
    } catch (error) {
      console.error('Error loading viewed content:', error);
    }
  };

  const saveViewedContent = async (contentId: string) => {
    try {
      const newViewed = new Set(viewedContent);
      newViewed.add(contentId);
      setViewedContent(newViewed);
      await AsyncStorage.setItem('viewedTrainingContent', JSON.stringify(Array.from(newViewed)));
    } catch (error) {
      console.error('Error saving viewed content:', error);
    }
  };

  const fetchTrainingContent = async () => {
    try {
      setLoading(true);

      console.log('📱 Fetching training content...');

      // Call the API to get training content
      const response = await apiService.getTrainingContent();

      console.log('📱 Training content response:', response);

      // Handle nested response structure from apiService
      const trainingData = response.data?.data || response.data;

      console.log('📱 Training data:', trainingData);

      if (response.success && trainingData && Array.isArray(trainingData) && trainingData.length > 0) {
        const content: TrainingContent[] = trainingData.map((item: any) => ({
          id: item._id,
          name: item.name,
          type: item.type as ContentType,
          testType: item.testType as TestType,
          viewed: false, // Will be updated from viewedContent
          fileUrl: item.fileUrl,
          fileName: item.fileName,
          description: item.description
        }));

        console.log('📱 Training content loaded:', content.length, 'items');

        setTrainingContent(content);

        // Load viewed status from AsyncStorage
        const viewed = await AsyncStorage.getItem('viewedTrainingContent');
        if (viewed) {
          const viewedSet = new Set<string>(JSON.parse(viewed));
          setViewedContent(viewedSet);

          // Check if all content viewed
          const allViewed = content.every(item => viewedSet.has(item.id));
          setTrainingCompleted(allViewed);
        }
      } else {
        console.log('📱 No training content available - trainingData:', trainingData);
        // Don't show alert, just show empty state in UI
        setTrainingContent([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching training content:', error);
      Alert.alert('Error', 'Failed to load training materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewContent = async (content: TrainingContent) => {
    try {
      console.log('========================================');
      console.log('📱 Opening content:', content.name);
      console.log('📱 Content type:', content.type);
      console.log('📱 Content ID:', content.id);
      console.log('📱 Direct file URL:', content.fileUrl);
      console.log('========================================');

      // Get signed URL for the content
      console.log('📱 Requesting signed URL...');
      const response = await apiService.getTrainingContentSignedUrl(content.id, 'inline');

      console.log('📱 Signed URL response:', JSON.stringify(response, null, 2));
      console.log('📱 Response success:', response.success);
      console.log('📱 Response URL:', response.data?.url);
      console.log('📱 Response data:', response.data);

      // Handle nested response structure
      const signedUrl = response.data?.url;

      console.log('📱 Extracted signed URL:', signedUrl);

      if (response.success && signedUrl) {
        console.log('📱 Checking if URL can be opened...');
        console.log('📱 URL to open:', signedUrl);

        const supported = await Linking.canOpenURL(signedUrl);
        console.log('📱 URL supported:', supported);

        if (supported) {
          console.log('📱 Opening URL...');
          await Linking.openURL(signedUrl);
          console.log('✅ URL opened successfully');

          // Mark as viewed after opening
          await saveViewedContent(content.id);

          // Update local state
          setTrainingContent(prev =>
            prev.map(item =>
              item.id === content.id ? { ...item, viewed: true } : item
            )
          );

          // Check if all viewed
          const newViewed = new Set(viewedContent);
          newViewed.add(content.id);
          const allViewed = trainingContent.every(item => newViewed.has(item.id));
          setTrainingCompleted(allViewed);

          Alert.alert('Success', 'Training material opened. It has been marked as viewed.');
        } else {
          console.log('❌ URL not supported by device');
          Alert.alert('Error', `Cannot open this file type: ${content.type}\n\nURL: ${signedUrl}`);
        }
      } else {
        console.log('⚠️ Signed URL request failed, trying fallback...');
        console.log('📱 Fallback URL:', content.fileUrl);

        // Fallback to direct URL if signed URL fails
        if (content.fileUrl) {
          console.log('📱 Using direct URL as fallback');
          const supported = await Linking.canOpenURL(content.fileUrl);
          console.log('📱 Direct URL supported:', supported);

          if (supported) {
            console.log('📱 Opening direct URL...');
            await Linking.openURL(content.fileUrl);
            await saveViewedContent(content.id);
            console.log('✅ Direct URL opened successfully');
          } else {
            console.log('❌ Direct URL not supported');
            Alert.alert('Error', `Cannot open URL: ${content.fileUrl}`);
          }
        } else {
          console.log('❌ No URL available to open');
          Alert.alert('Error', 'Unable to open this training material - no URL available');
        }
      }
      console.log('========================================');
    } catch (error: any) {
      console.error('❌ Error opening content:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', `Failed to open training material: ${error.message}`);
    }
  };

  const handleMarkComplete = async () => {
    console.log('========================================');
    console.log('📝 Mark Training Complete clicked');
    console.log('📝 Training completed:', trainingCompleted);
    console.log('📝 Total content:', trainingContent.length);
    console.log('📝 Viewed content:', viewedContent.size);
    console.log('========================================');

    if (!trainingCompleted) {
      Alert.alert(
        'Incomplete Training',
        'Please view all training materials before marking as complete.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log('📚 Calling backend API to mark training complete...');

      // Call backend API to mark training as complete
      const response = await apiService.markTrainingComplete();

      console.log('📚 Backend response:', response);

      if (response.success) {
        // Save to AsyncStorage for local reference
        await AsyncStorage.setItem('trainingCompleted', 'true');
        console.log('✅ Training marked as complete on backend and locally');

        Alert.alert(
          'Training Complete!',
          'Great job! You have completed all training materials. You can now take the required tests.',
          [
            {
              text: 'Take Tests Now',
              onPress: () => {
                console.log('📝 Navigating to TestsScreen...');
                try {
                  navigation.navigate('TestsScreen' as never);
                  console.log('✅ Navigation successful');
                } catch (error) {
                  console.error('❌ Navigation error:', error);
                }
              }
            },
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => {
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        console.error('❌ Failed to mark training complete:', response.error);
        Alert.alert('Error', response.error || 'Failed to mark training as complete. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error marking training complete:', error);
      Alert.alert('Error', 'Failed to save training completion status. Please try again.');
    }
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

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case 'PDF':
        return 'document-text';
      case 'VIDEO':
        return 'videocam';
      case 'IMAGE':
        return 'image';
    }
  };

  const groupedContent = trainingContent.reduce((acc, content) => {
    if (!acc[content.testType]) {
      acc[content.testType] = [];
    }
    acc[content.testType].push(content);
    return acc;
  }, {} as Record<TestType, TrainingContent[]>);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading training materials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={ri(24)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Training</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Ionicons name="information-circle" size={ri(24)} color={COLORS.accentBlue} />
          <Text style={styles.instructionsText}>
            Review all training materials before proceeding to tests. Tap on any material to view it.
          </Text>
        </View>

        {/* Empty State */}
        {trainingContent.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={ri(64)} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Training Materials Yet</Text>
            <Text style={styles.emptyStateText}>
              Training materials will appear here once uploaded by HR. Please check back later or contact your administrator.
            </Text>
          </View>
        )}

        {/* Training Content by Type */}
        {(['TDG', 'VEHICLE', 'HOS', 'WINTER'] as TestType[]).map((testType) => {
          const contents = groupedContent[testType] || [];
          if (contents.length === 0) return null;

          return (
            <View key={testType} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.testTypeBadge,
                    { backgroundColor: getTestTypeColor(testType) + '20' },
                  ]}
                >
                  <Text
                    style={[styles.testTypeText, { color: getTestTypeColor(testType) }]}
                  >
                    {getTestTypeLabel(testType)} Training
                  </Text>
                </View>
              </View>

              {contents.map((content) => {
                const isViewed = viewedContent.has(content.id);
                return (
                  <TouchableOpacity
                    key={content.id}
                    style={[
                      styles.contentCard,
                      isViewed && styles.contentCardViewed,
                    ]}
                    onPress={() => handleViewContent(content)}
                  >
                    <View style={styles.contentIconContainer}>
                      <Ionicons
                        name={getContentIcon(content.type) as any}
                        size={ri(24)}
                        color={getTestTypeColor(content.testType)}
                      />
                    </View>
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentName}>{content.name}</Text>
                      <Text style={styles.contentType}>{content.type}</Text>
                      {content.description && (
                        <Text style={styles.contentDescription} numberOfLines={2}>
                          {content.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.contentActions}>
                      {isViewed ? (
                        <View style={styles.viewedBadge}>
                          <Ionicons name="checkmark-circle" size={ri(20)} color={COLORS.accentGreen} />
                          <Text style={styles.viewedText}>Viewed</Text>
                        </View>
                      ) : (
                        <View style={styles.notViewedBadge}>
                          <Text style={styles.notViewedText}>Not Viewed</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleViewContent(content)}
                      >
                        <Text style={styles.viewButtonText}>
                          {content.type === 'VIDEO' ? 'Play' : 'View'}
                        </Text>
                        <Ionicons
                          name={content.type === 'VIDEO' ? 'play-circle' : 'open-outline'}
                          size={ri(16)}
                          color={COLORS.white}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Complete Button */}
        <TouchableOpacity
          style={[
            styles.completeButton,
            !trainingCompleted && styles.completeButtonDisabled,
          ]}
          onPress={handleMarkComplete}
          disabled={!trainingCompleted}
        >
          <Text style={styles.completeButtonText}>Mark Training Complete →</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgMain, }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  loadingText: { marginTop: rs(16), fontSize: rf(16), color: COLORS.textSecondary, },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(16), paddingVertical: rs(12), backgroundColor: COLORS.bgCard, borderTopWidth: 2, borderTopColor: COLORS.accentBlue, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, }, backButton: { padding: rs(8), }, headerTitle: { fontSize: rf(18), fontWeight: '700', color: COLORS.textPrimary, }, placeholder: { width: rs(40), }, scrollView: { flex: 1, }, contentContainer: { padding: rs(16), paddingBottom: Platform.OS === 'android' ? rs(80) : rs(32), paddingTop: rs(16), },
  instructionsCard: { flexDirection: 'row', backgroundColor: 'rgba(0,209,255,0.08)', padding: rs(16), borderRadius: rs(12), marginBottom: rs(24), borderLeftWidth: 3, borderLeftColor: COLORS.accentBlue, }, instructionsText: { flex: 1, marginLeft: rs(12), fontSize: rf(14), color: COLORS.textSecondary, lineHeight: rf(20), },
  section: { marginBottom: rs(24), }, sectionHeader: { marginBottom: rs(12), }, testTypeBadge: { alignSelf: 'flex-start', paddingHorizontal: rs(12), paddingVertical: rs(6), borderRadius: rs(16), }, testTypeText: { fontSize: rf(15), fontWeight: '700', },
  contentCard: { backgroundColor: COLORS.bgCard, borderRadius: rs(12), padding: rs(16), marginBottom: rs(12), flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderSubtle, }, contentCardViewed: { borderColor: COLORS.accentGreen, backgroundColor: 'rgba(0,255,163,0.06)', }, contentIconContainer: { width: rs(48), height: rs(48), borderRadius: rs(24), backgroundColor: COLORS.bgCardLight, justifyContent: 'center', alignItems: 'center', marginRight: rs(12), }, contentInfo: { flex: 1, }, contentName: { fontSize: rf(15), fontWeight: '600', color: COLORS.textPrimary, marginBottom: rs(4), }, contentType: { fontSize: rf(12), color: COLORS.textSecondary, }, contentDescription: { fontSize: rf(12), color: COLORS.textSecondary, marginTop: rs(4), lineHeight: rf(16), }, contentActions: { alignItems: 'flex-end', }, viewedBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(8), }, viewedText: { marginLeft: rs(4), fontSize: rf(12), fontWeight: '600', color: COLORS.accentGreen, }, notViewedBadge: { marginBottom: rs(8), }, notViewedText: { fontSize: rf(12), fontWeight: '600', color: COLORS.accentOrange, }, viewButton: { backgroundColor: COLORS.accentNavyBlue, paddingHorizontal: rs(14), paddingVertical: rs(7), borderRadius: rs(8), flexDirection: 'row', alignItems: 'center', gap: rs(6), }, viewButtonText: { fontSize: rf(13), fontWeight: '600', color: COLORS.white, },
  completeButton: { backgroundColor: COLORS.accentNavyBlue, padding: rs(16), borderRadius: rs(12), alignItems: 'center', marginTop: rs(8), }, completeButtonDisabled: { backgroundColor: COLORS.statusNeutral, }, completeButtonText: { fontSize: rf(16), fontWeight: '700', color: COLORS.white, },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: rs(48), paddingHorizontal: rs(24), }, emptyStateTitle: { fontSize: rf(18), fontWeight: '700', color: COLORS.textPrimary, marginTop: rs(16), marginBottom: rs(8), }, emptyStateText: { fontSize: rf(14), color: COLORS.textSecondary, textAlign: 'center', lineHeight: rf(20), }, bottomSpacer: { height: rs(16), },
});

export default TrainingScreen;
