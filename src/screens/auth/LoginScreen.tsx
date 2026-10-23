// src/screens/auth/LoginScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
  ScrollView,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/AppNavigator";
import { apiService } from "../../services/api/apiService";
import { authManager } from "../../types/AuthManager";
import { logger } from "../../utils/loggerHelper";
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from "../../theme";

const logo = require("../../../assets/FleetGo.png");

type Props = NativeStackScreenProps<RootStackParamList, "Login"> & {
  onAuthSuccess: (userData?: any) => void;
};

interface LoginErrors {
  email?: string | null;
  password?: string | null;
}

export default function LoginScreen({ navigation, onAuthSuccess }: Props) {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 600;

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [errors, setErrors]             = useState<LoginErrors>({});
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused]   = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    logger.userAction("Screen View", { screen: "LoginScreen" }, "LoginScreen");
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // ─── Validation ──────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Login handler ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (isLoading) return;
    setErrors({});
    if (!validateForm()) {
      logger.userAction("Login Validation Failed", { email }, "LoginScreen");
      return;
    }

    setIsLoading(true);
    const loginTimer = logger.startTimer("Login Process");

    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        loginTimer();
        setErrors({ email: "Connection timeout. Please check your internet connection and try again." });
      }
    }, 30000);

    try {
      logger.userAction("Login Attempt", { email }, "LoginScreen");
      const response = await apiService.login(email, password);
      clearTimeout(timeoutId);

      logger.debug("Login response received", {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data && typeof response.data === "object" ? Object.keys(response.data) : null,
      });

      const backendResponse = response.data;
      const driverData =
        backendResponse?.driver ||
        (backendResponse && "id" in backendResponse ? backendResponse : null);

      if (response.success && driverData && typeof driverData === "object" && "id" in driverData) {
        const driver = driverData as { id: string; name: string; email: string; token: string };
        await authManager.login({ id: driver.id, name: driver.name, email: driver.email, token: driver.token });
        logger.userAction("Login Success", { userId: driver.id, email: driver.email }, "LoginScreen");
        onAuthSuccess(driver);
      } else {
        const newErrors: LoginErrors = {};
        const br = response.data as any;
        let errorMessage = br?.message || br?.error || response.error || "";
        const statusCode = response.statusCode || 0;

        if (statusCode === 401 || statusCode === 404 || statusCode === 400) {
          logger.userAction("Login Failed - Invalid Credentials", { email, error: errorMessage, statusCode }, "LoginScreen");
          if (errorMessage.toLowerCase().includes("driver not found") || errorMessage.toLowerCase().includes("not found") || statusCode === 404) {
            newErrors.email = errorMessage || `Driver not found with email: ${email}. Please check and try again.`;
          } else if (errorMessage.toLowerCase().includes("invalid credentials") || errorMessage.toLowerCase().includes("password") || statusCode === 401) {
            newErrors.password = errorMessage || "Incorrect password. Please check and try again.";
          } else {
            newErrors.email = errorMessage || "Incorrect email address or password.";
          }
        } else if (statusCode === 0 || errorMessage.includes("Unable to connect") || errorMessage.includes("Network request failed") || errorMessage.includes("timeout")) {
          newErrors.email = "Unable to connect to server. Please check your internet connection.";
        } else if (statusCode === 403) {
          newErrors.email = errorMessage || "Your account is not active. Please contact your administrator.";
        } else {
          newErrors.email = errorMessage || "Login failed. Please try again.";
        }
        setErrors(newErrors);
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error instanceof Error) {
        if (error.message === "Network request failed")    errorMessage = "Unable to connect to server. Please check your internet connection.";
        else if (error.message.includes("timeout"))       errorMessage = "Connection timeout. Please try again.";
        else if (error.message.includes("ECONNREFUSED"))  errorMessage = "Server is not available. Please try again later.";
        logger.error("Login error", { error: error.message, stack: error.stack, email }, "LoginScreen");
      } else {
        logger.error("Login error", { error: String(error), email }, "LoginScreen");
      }
      setErrors({ email: errorMessage });
    } finally {
      setIsLoading(false);
      loginTimer();
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
  };

  // ─── Input border helper ──────────────────────────────────────────────────────
  const inputBorder = (focused: boolean, hasError?: string | null) => {
    if (hasError) return COLORS.accentRed;
    if (focused)  return COLORS.accentBlue;
    return COLORS.borderSubtle;
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgMain} />

      {/* Background depth glows */}
      <View style={styles.bgGlow1} pointerEvents="none" />
      <View style={styles.bgGlow2} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kavFlex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.inner, isTablet && styles.innerTablet]}>

            {/* ── Brand / Hero ──────────────────────────────────────────────── */}
            <View style={[styles.heroSection, isTablet && styles.heroSectionTablet]}>
              <View style={styles.logoWrapper}>
               
                <Image
                  source={logo}
                  style={[styles.logoImage, isTablet && styles.logoImageTablet]}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.brandRow}>
                <Text style={[styles.tagline, isTablet && styles.taglineTablet]}>
                  All in One{" "}
                </Text>
                <View style={styles.taglineBadge}>
                  <Text style={[styles.taglineBadgeText, isTablet && styles.taglineTablet]}>
                    Driver Platform
                  </Text>
                </View>
              </View>

              <Text style={[styles.heroSub, isTablet && styles.heroSubTablet]}>
                Manage trips, logs &amp; fleet — from your pocket.
              </Text>
            </View>

            {/* ── Form Card ─────────────────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.formCard,
                isTablet && styles.formCardTablet,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* top accent line */}
              <View style={styles.cardAccentLine} />

              <View style={styles.welcomeBlock}>
                <Text style={[styles.welcomeTitle, isTablet && styles.welcomeTitleTablet]}>
                  Welcome Back
                </Text>
                <Text style={styles.welcomeSub}>Sign in to your account</Text>
              </View>

              {/* ── Email field ─────────────────────────────────────────────── */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View
                  style={[
                    styles.inputWrap,
                    { borderColor: inputBorder(emailFocused, errors.email), height: isTablet ? 60 : INPUT_HEIGHT },
                    emailFocused && styles.inputWrapFocused,
                    !!errors.email && styles.inputWrapError,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={17}
                    color={
                      errors.email
                        ? COLORS.accentRed
                        : emailFocused
                        ? COLORS.accentBlue
                        : COLORS.textSecondary
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.textSecondary}
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    returnKeyType="next"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
                {errors.email ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={12} color={COLORS.accentRed} />
                    <Text style={styles.errorText}>{errors.email}</Text>
                  </View>
                ) : null}
              </View>

              {/* ── Password field ──────────────────────────────────────────── */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View
                  style={[
                    styles.inputWrap,
                    { borderColor: inputBorder(passFocused, errors.password), height: isTablet ? 60 : INPUT_HEIGHT },
                    passFocused && styles.inputWrapFocused,
                    !!errors.password && styles.inputWrapError,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={
                      errors.password
                        ? COLORS.accentRed
                        : passFocused
                        ? COLORS.accentBlue
                        : COLORS.textSecondary
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textSecondary}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    disabled={isLoading}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={17}
                      color={errors.password ? COLORS.accentRed : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={12} color={COLORS.accentRed} />
                    <Text style={styles.errorText}>{errors.password}</Text>
                  </View>
                ) : null}
              </View>

              {/* ── Sign In button ───────────────────────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.signInBtn,
                  { height: isTablet ? 60 : INPUT_HEIGHT },
                  isLoading && styles.signInBtnDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.82}
              >
                {isLoading ? (
                  <View style={styles.btnContent}>
                    <ActivityIndicator color={COLORS.white} size="small" />
                    <Text style={[styles.signInText, { marginLeft: SPACING.sm }]}>
                      Signing in…
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnContent}>
                    <Ionicons
                      name="log-in-outline"
                      size={isTablet ? 24 : 19}
                      color={COLORS.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.signInText, isTablet && styles.signInTextTablet]}>Sign In</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ── Footer note ─────────────────────────────────────────────── */}
              <Text style={styles.footerNote}>
                Having trouble? Contact your fleet administrator.
              </Text>
            </Animated.View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT_HEIGHT  = 52;
const CARD_RADIUS   = 24;
const FORM_PADDING  = SPACING["2xl"];     // 32

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  kavFlex: {
    flex: 1,
  },

  // ── Background depth glows ────────────────────────────────────────────────────
  bgGlow1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.04,
    top: -60,
    left: -80,
  },
  bgGlow2: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.accentNavyBlue,
    opacity: 0.06,
    bottom: 80,
    right: -60,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentTablet: {
    justifyContent: "center",
    paddingVertical: SPACING["3xl"],
  },

  // ── Inner wrapper (tablet: constrained width) ─────────────────────────────────
  inner: {
    flex: 1,
  },
  innerTablet: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },

  // ── Hero / Brand ──────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: SPACING["3xl"],
    paddingBottom: SPACING["2xl"],
    paddingHorizontal: SPACING.xl,
  },
  heroSectionTablet: {
    paddingTop: SPACING["2xl"],
    paddingBottom: SPACING.xl,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
    position: "relative",
  },
  logoGlow: {
    position: "absolute",
    width: 180,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.07,
  },
  logoImage: {
    width: 160,
    height: 52,
  },
  logoImageTablet: {
    width: 190,
    height: 62,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: FONT_SIZE["2xl"],
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: -0.3,
  },
  taglineTablet: {
    fontSize: FONT_SIZE["3xl"],
  },
  taglineBadge: {
    borderWidth: 1.5,
    borderColor: COLORS.accentBlue,
    backgroundColor: "rgba(0,209,255,0.08)",
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  taglineBadgeText: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.accentBlue,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.1,
  },
  heroSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  heroSubTablet: {
    fontSize: FONT_SIZE.base,
    lineHeight: 22,
  },

  // ── Form card ─────────────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: COLORS.bgCardLight,
    borderTopLeftRadius:  CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    paddingHorizontal: FORM_PADDING,
    paddingBottom: SPACING["3xl"],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0,209,255,0.12)",
    // elevation shadow
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  formCardTablet: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(0,209,255,0.14)",
    paddingBottom: FORM_PADDING,
    shadowOffset: { width: 0, height: 4 },
  },

  // top accent line
  cardAccentLine: {
    height: 4,
    width: 36,
    backgroundColor: COLORS.accentBlue,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    opacity: 0.5,
  },

  // welcome block
  welcomeBlock: {
    alignItems: "center",
    marginBottom: SPACING["2xl"],
  },
  welcomeTitle: {
    fontSize: FONT_SIZE["2xl"],
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
    marginBottom: SPACING.xs,
  },
  welcomeTitleTablet: {
    fontSize: FONT_SIZE["3xl"],
  },
  welcomeSub: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },

  // ── Field groups ──────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: SPACING.md,
  },
  inputWrapFocused: {
    backgroundColor: "rgba(17,131,224,0.06)",
  },
  inputWrapError: {
    backgroundColor: "rgba(244,63,94,0.04)",
  },
  inputIcon: {
    marginRight: SPACING.md,
  },
  textInput: {
    flex: 1,
    height: INPUT_HEIGHT,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingLeft: SPACING.sm,
  },

  // ── Error row ─────────────────────────────────────────────────────────────────
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accentRed,
    flex: 1,
    lineHeight: 16,
  },

  // ── Sign In button ────────────────────────────────────────────────────────────
  signInBtn: {
    backgroundColor: COLORS.accentNavyBlue,
    borderRadius: RADIUS.lg,
    height: INPUT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
    shadowColor: COLORS.accentNavyBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  signInBtnDisabled: {
    backgroundColor: "rgba(17,131,224,0.35)",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  signInText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    letterSpacing: 0.4,
  },
  signInTextTablet: {
    fontSize: FONT_SIZE.lg,
  },

  // ── Footer note ───────────────────────────────────────────────────────────────
  footerNote: {
    marginTop: SPACING.xl,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0.1,
  },
});
