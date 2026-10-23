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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { apiService } from '../../services/api/apiService';
import { COLORS, rs, rf, ri } from '../../theme';

type TestType = 'TDG' | 'VEHICLE' | 'HOS' | 'WINTER';

interface Question {
  _id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuestionBank {
  _id: string;
  testName: string;
  testType: TestType;
  passingPercentage: number;
  questions: Question[];
}

interface UserAnswer {
  questionId: string;
  selectedAnswer: number;
}

const TakeTestScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { testType } = route.params as { testType: TestType };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      
      console.log('========================================');
      console.log('📝 Fetching questions for test type:', testType);
      
      // Fetch question bank from backend
      const response = await apiService.getQuestionBank(testType);
      
      console.log('📝 Full response:', JSON.stringify(response, null, 2));
      console.log('📝 Response success:', response.success);
      console.log('📝 Response data type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
      
      if (response.success) {
        // Handle nested data structure
        let questionBanksArray = response.data;
        
        // Check if data is wrapped
        if (response.data?.data) {
          questionBanksArray = response.data.data;
          console.log('📝 Data was wrapped, extracted inner data');
        }
        
        console.log('📝 Question banks array:', questionBanksArray);
        console.log('📝 Is array:', Array.isArray(questionBanksArray));
        console.log('📝 Array length:', Array.isArray(questionBanksArray) ? questionBanksArray.length : 'Not an array');
        
        if (Array.isArray(questionBanksArray) && questionBanksArray.length > 0) {
          const data = questionBanksArray[0];
          console.log('📝 First question bank:', JSON.stringify(data, null, 2));
          
          if (data && data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestionBank(data);
            console.log('✅ Loaded', data.questions.length, 'questions');
            console.log('✅ Question bank set successfully');
          } else {
            console.error('❌ No questions in question bank:', data);
            Alert.alert(
              'No Questions Available',
              `No questions have been added for the ${getTestTypeLabel(testType)} test.\n\nPlease contact HR to add questions for this test.`
            );
            navigation.goBack();
          }
        } else {
          console.error('❌ No question banks found for test type:', testType);
          Alert.alert(
            'Test Not Available',
            `The ${getTestTypeLabel(testType)} test has not been set up yet.\n\nPlease contact HR to create this test.`
          );
          navigation.goBack();
        }
      } else {
        console.error('❌ API returned error:', response.error || response.message);
        Alert.alert('Error', response.error || 'Failed to load test questions. Please try again.');
        navigation.goBack();
      }
      console.log('========================================');
    } catch (error: any) {
      console.error('❌ Error fetching questions:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', `Failed to load test: ${error.message}`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    console.log('📝 Selected answer:', { questionId, optionIndex });
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, optionIndex);
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (!questionBank) return;
    
    if (currentQuestionIndex < questionBank.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!questionBank) return;

    // Check if all questions are answered
    const unansweredCount = questionBank.questions.length - answers.size;
    
    if (unansweredCount > 0) {
      Alert.alert(
        'Incomplete Test',
        `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Do you want to submit anyway?`,
        [
          { text: 'Continue Testing', style: 'cancel' },
          { text: 'Submit', onPress: submitTest, style: 'destructive' }
        ]
      );
      return;
    }

    submitTest();
  };

  const submitTest = async () => {
    if (!questionBank) return;

    try {
      setSubmitting(true);
      
      console.log('========================================');
      console.log('📤 Submitting test answers');
      console.log('📝 Test type:', testType);
      console.log('📝 Question bank ID:', questionBank._id);
      console.log('📝 Total answers:', answers.size);
      
      // Get user data
      let userDataStr = await AsyncStorage.getItem('user_data');
      if (!userDataStr) {
        userDataStr = await AsyncStorage.getItem('@fleetgo_user_data');
      }
      
      if (!userDataStr) {
        Alert.alert('Error', 'User data not found. Please login again.');
        return;
      }

      const userData = JSON.parse(userDataStr);
      const driverId = userData._id || userData.id;

      // Format answers for submission
      // IMPORTANT: Use the exact question ID from the question bank
      const formattedAnswers: UserAnswer[] = questionBank.questions.map((q, index) => {
        const questionId = q._id?.toString() || index.toString();
        const selectedAnswer = answers.get(questionId) ?? -1;
        
        console.log(`📝 Question ${index + 1}:`, {
          questionId,
          selectedAnswer,
          correctAnswer: q.correctAnswer,
          question: q.question.substring(0, 50) + '...'
        });
        
        return {
          questionId,
          selectedAnswer
        };
      });

      console.log('📤 Formatted answers:', formattedAnswers);

      // Submit to backend
      const response = await apiService.submitTestResult({
        driverId,
        testType,
        questionBankId: questionBank._id,
        answers: formattedAnswers
      });

      console.log('📤 Submit response:', JSON.stringify(response, null, 2));
      console.log('========================================');

      if (response.success && response.data) {
        // Handle nested data structure: response.data.data or response.data
        let data = response.data;
        
        // Check if data is nested
        if (data.data && typeof data.data === 'object') {
          data = data.data;
          console.log('📤 Using nested data structure');
        }
        
        console.log('📤 Extracted data:', JSON.stringify(data, null, 2));
        console.log('📤 Data keys:', Object.keys(data));
        
        // Try multiple possible locations for score
        // IMPORTANT: Use nullish coalescing (??) instead of || because score can be 0 (falsy)
        const score = data.score ?? data.data?.score ?? null;
        const passed = data.passed !== undefined ? data.passed : (data.data?.passed !== undefined ? data.data.passed : false);
        
        console.log('📊 Score extracted:', score);
        console.log('📊 Score type:', typeof score);
        console.log('📊 Passed extracted:', passed);
        
        if (score === null || score === undefined) {
          console.error('❌ Score is null/undefined in response');
          console.error('❌ Full response structure:', JSON.stringify(response, null, 2));
          Alert.alert('Error', 'Failed to get test score. Please check console logs.');
          return;
        }
        
        // Save test completion to AsyncStorage
        const allTests = await AsyncStorage.getItem('completedTests');
        const completedTests = allTests ? JSON.parse(allTests) : [];
        if (!completedTests.includes(testType)) {
          completedTests.push(testType);
          await AsyncStorage.setItem('completedTests', JSON.stringify(completedTests));
        }

        // Navigate to results screen with detailed results
        navigation.navigate('TestResultsScreen', {
          testResult: {
            score,
            passed,
            attempts: data.attempts || 1,
            answers: data.answers || [],
            questionBank: {
              testName: questionBank.testName,
              testType: questionBank.testType,
              passingPercentage: questionBank.passingPercentage,
              questions: questionBank.questions
            }
          },
          testType
        });
      } else {
        console.error('❌ Submit failed:', response.error || response.message);
        Alert.alert('Error', response.error || response.message || 'Failed to submit test. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error submitting test:', error);
      Alert.alert('Error', 'Failed to submit test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea3d8" />
          <Text style={styles.loadingText}>Loading test...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!questionBank || questionBank.questions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>No questions available</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questionBank.questions[currentQuestionIndex];
  const selectedAnswer = answers.get(currentQuestion._id || currentQuestionIndex.toString());
  const progress = ((currentQuestionIndex + 1) / questionBank.questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{getTestTypeLabel(testType)}</Text>
          <Text style={styles.headerSubtitle}>{questionBank.testName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            Question {currentQuestionIndex + 1} of {questionBank.questions.length}
          </Text>
          <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: getTestTypeColor(testType) }]} />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionCard}>
          <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1}</Text>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected
                ]}
                onPress={() => handleSelectAnswer(currentQuestion._id || currentQuestionIndex.toString(), index)}
              >
                <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                  {isSelected && <View style={styles.optionRadioInner} />}
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {String.fromCharCode(65 + index)}. {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Navigation */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSecondary, currentQuestionIndex === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <Ionicons name="chevron-back" size={20} color={currentQuestionIndex === 0 ? '#9CA3AF' : '#1F2937'} />
            <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          {currentQuestionIndex < questionBank.questions.length - 1 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={handleNext}
            >
              <Text style={styles.navButtonTextPrimary}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSubmit, submitting && styles.navButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.navButtonTextPrimary}>Submit Test</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Test Info */}
        <View style={styles.testInfo}>
          <View style={styles.testInfoRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
            <Text style={styles.testInfoText}>
              Passing Score: {questionBank.passingPercentage}%
            </Text>
          </View>
          <View style={styles.testInfoRow}>
            <Ionicons name="document-text-outline" size={20} color="#0ea3d8" />
            <Text style={styles.testInfoText}>
              Answered: {answers.size} / {questionBank.questions.length}
            </Text>
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
  backgroundColor: COLORS.bgMain,
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
  marginBottom: rs(24),
  fontSize: rf(14),
  color: COLORS.accentOrange,
  textAlign: 'center',
},

// ✅ HEADER (same as other screens)
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

// ✅ PROGRESS
progressSection: {
  backgroundColor: COLORS.bgCard,
  padding: rs(16),
  borderBottomWidth: 1,
  borderBottomColor: COLORS.borderSubtle,
},

progressHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: rs(8),
},

progressLabel: {
  fontSize: rf(13),
  fontWeight: '600',
  color: COLORS.textSecondary,
},

progressPercent: {
  fontSize: rf(13),
  fontWeight: '700',
  color: COLORS.accentBlue,
},

progressBarContainer: {
  height: rs(6),
  backgroundColor: COLORS.borderSubtle,
  borderRadius: rs(6),
  overflow: 'hidden',
},

progressBar: {
  height: '100%',
  borderRadius: rs(6),
},

scrollView: {
  flex: 1,
},

contentContainer: {
  padding: rs(16),
  paddingBottom: Platform.OS === 'android' ? rs(80) : rs(32),
  paddingTop: rs(16),
},

// ✅ QUESTION CARD (same card system)
questionCard: {
  backgroundColor: COLORS.bgCard,
  borderRadius: rs(12),
  padding: rs(16),
  marginBottom: rs(16),
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
  elevation: 2,
},

questionNumber: {
  fontSize: rf(13),
  fontWeight: '600',
  color: COLORS.accentBlue,
  marginBottom: rs(8),
},

questionText: {
  fontSize: rf(15),
  fontWeight: '600',
  color: COLORS.textPrimary,
  lineHeight: rf(22),
},

// ✅ OPTIONS
optionsContainer: {
  marginBottom: rs(16),
},

optionCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: COLORS.bgCard,
  borderRadius: rs(12),
  padding: rs(14),
  marginBottom: rs(10),
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
},

optionCardSelected: {
  borderColor: COLORS.accentBlue,
  backgroundColor: 'rgba(0,209,255,0.08)',
},

optionRadio: {
  width: rs(22),
  height: rs(22),
  borderRadius: rs(11),
  borderWidth: 2,
  borderColor: COLORS.borderSubtle,
  marginRight: rs(10),
  justifyContent: 'center',
  alignItems: 'center',
},

optionRadioSelected: {
  borderColor: COLORS.accentBlue,
},

optionRadioInner: {
  width: rs(10),
  height: rs(10),
  borderRadius: rs(5),
  backgroundColor: COLORS.accentBlue,
},

optionText: {
  flex: 1,
  fontSize: rf(14),
  color: COLORS.textSecondary,
  lineHeight: rf(20),
},

optionTextSelected: {
  color: COLORS.textPrimary,
  fontWeight: '600',
},

// ✅ NAVIGATION BUTTONS
navigationContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: rs(16),
},

navButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: rs(12),
  borderRadius: rs(10),
  flex: 1,
  marginHorizontal: rs(4),
  justifyContent: 'center',
},

navButtonSecondary: {
  backgroundColor: COLORS.bgCard,
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
},

navButtonPrimary: {
  backgroundColor: COLORS.accentNavyBlue,
},

navButtonSubmit: {
  backgroundColor: COLORS.accentGreen,
},

navButtonDisabled: {
  opacity: 0.5,
},

navButtonText: {
  fontSize: rf(14),
  fontWeight: '600',
  color: COLORS.textPrimary,
  marginLeft: rs(4),
},

navButtonTextPrimary: {
  fontSize: rf(14),
  fontWeight: '600',
  color: COLORS.white,
  marginRight: rs(4),
},

navButtonTextDisabled: {
  color: COLORS.statusNeutral,
},

// ✅ TEST INFO
testInfo: {
  backgroundColor: COLORS.bgCardLight,
  borderRadius: rs(12),
  padding: rs(14),
  marginBottom: rs(16),
},

testInfoRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: rs(8),
},

testInfoText: {
  fontSize: rf(13),
  color: COLORS.textSecondary,
  marginLeft: rs(8),
},

// ✅ GENERIC BUTTON
button: {
  backgroundColor: COLORS.accentNavyBlue,
  paddingVertical: rs(12),
  paddingHorizontal: rs(20),
  borderRadius: rs(10),
},

buttonText: {
  color: COLORS.white,
  fontSize: rf(15),
  fontWeight: '600',
},

bottomSpacer: {
  height: rs(16),
},
});

export default TakeTestScreen;

