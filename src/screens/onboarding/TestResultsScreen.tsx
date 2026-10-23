import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, rs, rf, ri } from '../../theme';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';

interface Answer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

interface Question {
  _id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TestResult {
  score: number;
  passed: boolean;
  attempts: number;
  answers: Answer[];
  questionBank: {
    testName: string;
    testType: TestType;
    passingPercentage: number;
    questions: Question[];
  };
}

const TestResultsScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { testResult, testType } = route.params as { testResult: TestResult; testType: TestType };

  const getTestTypeLabel = (type: TestType) => {
    switch (type) {
      case 'TDG':
        return 'TDG (Dangerous Goods)';
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
        return '#DC2626';
      case 'VEHICLE':
        return '#0ea3d8';
      case 'HOS':
        return '#059669';
      case 'WINTER':
        return '#3B82F6';
    }
  };

  const correctCount = testResult.answers.filter(a => a.isCorrect).length;
  const totalQuestions = testResult.answers.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Test Results</Text>
            <Text style={styles.headerSubtitle}>{getTestTypeLabel(testType)}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Score Card */}
        <View style={[
          styles.scoreCard,
          testResult.passed ? styles.scoreCardPassed : styles.scoreCardFailed
        ]}>
          <View style={styles.scoreIconContainer}>
            {testResult.passed ? (
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            ) : (
              <Ionicons name="close-circle" size={64} color="#EF4444" />
            )}
          </View>
          <Text style={styles.scoreValue}>{testResult.score}%</Text>
          <Text style={styles.scoreLabel}>
            {testResult.passed ? '🎉 Passed!' : '❌ Failed'}
          </Text>
          <Text style={styles.scoreDetails}>
            {correctCount} out of {totalQuestions} questions correct
          </Text>
          <Text style={styles.passingInfo}>
            Passing Score: {testResult.questionBank.passingPercentage}%
          </Text>
        </View>

        {/* Results Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Test Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Test Name:</Text>
            <Text style={styles.summaryValue}>{testResult.questionBank.testName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Attempt:</Text>
            <Text style={styles.summaryValue}>#{testResult.attempts}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Score:</Text>
            <Text style={[styles.summaryValue, { color: testResult.passed ? '#10B981' : '#EF4444' }]}>
              {testResult.score}%
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              testResult.passed ? styles.statusBadgePassed : styles.statusBadgeFailed
            ]}>
              <Text style={[
                styles.statusText,
                testResult.passed ? styles.statusTextPassed : styles.statusTextFailed
              ]}>
                {testResult.passed ? 'Passed' : 'Failed'}
              </Text>
            </View>
          </View>
        </View>

        {/* Question Review */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>Question Review</Text>
          <Text style={styles.reviewSubtitle}>
            Review your answers and see which ones were correct
          </Text>

          {testResult.questionBank.questions.map((question, index) => {
            const answer = testResult.answers.find(a => 
              a.questionId === question._id || a.questionId === index.toString()
            );
            const selectedIndex = answer?.selectedAnswer ?? -1;
            const isCorrect = answer?.isCorrect ?? false;

            return (
              <View key={question._id || index} style={styles.questionReviewCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Question {index + 1}</Text>
                  {isCorrect ? (
                    <View style={styles.correctBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={styles.correctText}>Correct</Text>
                    </View>
                  ) : (
                    <View style={styles.incorrectBadge}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                      <Text style={styles.incorrectText}>Incorrect</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.questionText}>{question.question}</Text>

                <View style={styles.optionsContainer}>
                  {selectedIndex >= 0 && selectedIndex < question.options.length ? (
                    <View style={[
                      styles.optionItem,
                      isCorrect ? styles.optionCorrect : styles.optionIncorrect
                    ]}>
                      <View style={styles.optionIndicator}>
                        {isCorrect ? (
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        ) : (
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        )}
                      </View>
                      <Text style={[
                        styles.optionText,
                        isCorrect ? styles.optionTextCorrect : styles.optionTextIncorrect
                      ]}>
                        {String.fromCharCode(65 + selectedIndex)}. {question.options[selectedIndex]}
                      </Text>
                      <Text style={isCorrect ? styles.correctLabel : styles.incorrectLabel}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.optionItem}>
                      <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                      <Text style={styles.optionText}>No answer selected</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {testResult.passed ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => {
                // Navigate directly to TestsScreen - useFocusEffect will refresh the data
                // This will pop the stack back to TestsScreen and trigger refresh
                navigation.navigate('TestsScreen' as never);
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Continue to Test List</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => {
                  // Just scroll to review, stay on this screen
                  // This button can be removed or kept for scrolling
                }}
                disabled
              >
                <Text style={styles.actionButtonTextSecondary}>Review Above</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => {
                  // Navigate back to take test again
                  navigation.navigate('TakeTestScreen', { testType });
                }}
              >
                <Ionicons name="refresh-circle" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Retake Test</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

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
  padding: rs(16),
  paddingBottom: Platform.OS === 'android' ? rs(80) : rs(32),
  paddingTop: rs(16),
},

// ✅ HEADER (same everywhere)
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

placeholder: {
  width: rs(40),
},

headerContent: {
  flex: 1,
  alignItems: 'center',
},

headerTitle: {
  fontSize: rf(18),
  fontWeight: '700',
  color: COLORS.textPrimary,
},

headerSubtitle: {
  fontSize: rf(13),
  color: COLORS.textSecondary,
  marginTop: rs(2),
},

// ✅ SCORE CARD
scoreCard: {
  backgroundColor: COLORS.bgCard,
  borderRadius: rs(12),
  padding: rs(20),
  alignItems: 'center',
  marginBottom: rs(16),

  borderWidth: 1,
  borderColor: COLORS.borderSubtle,

  elevation: 2,
},

scoreCardPassed: {
  borderColor: COLORS.accentGreen,
  backgroundColor: 'rgba(0,255,163,0.08)',
},

scoreCardFailed: {
  borderColor: COLORS.accentOrange,
  backgroundColor: 'rgba(255,165,0,0.08)',
},

scoreIconContainer: {
  marginBottom: rs(12),
},

scoreValue: {
  fontSize: rf(36),
  fontWeight: '700',
  color: COLORS.textPrimary,
  marginBottom: rs(6),
},

scoreLabel: {
  fontSize: rf(18),
  fontWeight: '700',
  color: COLORS.textPrimary,
  marginBottom: rs(6),
},

scoreDetails: {
  fontSize: rf(14),
  color: COLORS.textSecondary,
},

passingInfo: {
  fontSize: rf(12),
  color: COLORS.textSecondary,
  marginTop: rs(6),
},

// ✅ SUMMARY CARD
summaryCard: {
  backgroundColor: COLORS.bgCard,
  padding: rs(16),
  borderRadius: rs(12),
  marginBottom: rs(16),
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
},

summaryTitle: {
  fontSize: rf(16),
  fontWeight: '700',
  color: COLORS.textPrimary,
  marginBottom: rs(12),
},

summaryRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: rs(10),
},

summaryLabel: {
  fontSize: rf(13),
  color: COLORS.textSecondary,
},

summaryValue: {
  fontSize: rf(13),
  fontWeight: '600',
  color: COLORS.textPrimary,
},

// ✅ STATUS BADGE
statusBadge: {
  paddingHorizontal: rs(10),
  paddingVertical: rs(4),
  borderRadius: rs(12),
},

statusBadgePassed: {
  backgroundColor: 'rgba(0,255,163,0.12)',
},

statusBadgeFailed: {
  backgroundColor: 'rgba(255,165,0,0.12)',
},

statusText: {
  fontSize: rf(12),
  fontWeight: '600',
},

statusTextPassed: {
  color: COLORS.accentGreen,
},

statusTextFailed: {
  color: COLORS.accentOrange,
},

// ✅ REVIEW SECTION
reviewSection: {
  marginBottom: rs(16),
},

reviewTitle: {
  fontSize: rf(16),
  fontWeight: '700',
  color: COLORS.textPrimary,
  marginBottom: rs(4),
},

reviewSubtitle: {
  fontSize: rf(13),
  color: COLORS.textSecondary,
  marginBottom: rs(12),
},

questionReviewCard: {
  backgroundColor: COLORS.bgCard,
  borderRadius: rs(12),
  padding: rs(14),
  marginBottom: rs(12),
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
},

questionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: rs(8),
},

questionNumber: {
  fontSize: rf(13),
  fontWeight: '600',
  color: COLORS.accentBlue,
},

correctBadge: {
  flexDirection: 'row',
  alignItems: 'center',
},

correctText: {
  marginLeft: rs(4),
  fontSize: rf(12),
  color: COLORS.accentGreen,
},

incorrectBadge: {
  flexDirection: 'row',
  alignItems: 'center',
},

incorrectText: {
  marginLeft: rs(4),
  fontSize: rf(12),
  color: COLORS.accentOrange,
},

questionText: {
  fontSize: rf(14),
  color: COLORS.textPrimary,
  marginBottom: rs(10),
},

// ✅ OPTIONS
optionsContainer: {
  gap: rs(8),
},

optionItem: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: rs(10),
  borderRadius: rs(10),
  backgroundColor: COLORS.bgCardLight,
},

optionCorrect: {
  backgroundColor: 'rgba(0,255,163,0.12)',
},

optionIncorrect: {
  backgroundColor: 'rgba(255,165,0,0.12)',
},

optionIndicator: {
  marginRight: rs(10),
},

optionText: {
  flex: 1,
  fontSize: rf(13),
  color: COLORS.textSecondary,
},

optionTextCorrect: {
  color: COLORS.accentGreen,
  fontWeight: '600',
},

optionTextIncorrect: {
  color: COLORS.accentOrange,
  fontWeight: '600',
},

correctLabel: {
  fontSize: rf(11),
  color: COLORS.accentGreen,
},

incorrectLabel: {
  fontSize: rf(11),
  color: COLORS.accentOrange,
},

// ✅ ACTION BUTTONS
actionContainer: {
  flexDirection: 'row',
  gap: rs(12),
},

actionButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: rs(14),
  borderRadius: rs(12),
  gap: rs(6),
},

actionButtonPrimary: {
  backgroundColor: COLORS.accentNavyBlue,
},

actionButtonSecondary: {
  backgroundColor: COLORS.bgCard,
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
},

actionButtonText: {
  fontSize: rf(14),
  fontWeight: '600',
  color: COLORS.white,
},

actionButtonTextSecondary: {
  fontSize: rf(14),
  fontWeight: '600',
  color: COLORS.textPrimary,
},

bottomSpacer: {
  height: rs(16),
},
});

export default TestResultsScreen;

