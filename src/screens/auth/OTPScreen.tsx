// src/screens/auth/OTPScreen.js
import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/AppNavigator";
// Asset import - using require for better compatibility with Expo Go
const otpImage = require("../../../assets/images/otp.png");
const logo = require("../../../assets/FleetGo.png");

// Updated interface to work with new auth system
type Props = NativeStackScreenProps<RootStackParamList, "OTP"> & {
    onAuthSuccess: (userData?: any) => void;
};

export default function OTPScreen({ navigation, onAuthSuccess }: Props) {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(109); // 01:49 in seconds
    const inputs = useRef<TextInput[]>([]);

    // Start countdown timer
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Format timer display (MM:SS)
    const formatTimer = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleChange = (value: string, index: number) => {
        if (/^[0-9]?$/.test(value)) {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);

            if (value && index < 5) {
                inputs.current[index + 1]?.focus();
            }

            // Auto-verify when all digits are entered
            if (newOtp.every(digit => digit !== "") && newOtp.join("").length === 6) {
                setTimeout(() => handleVerify(newOtp.join("")), 100);
            }
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpValue?: string) => {
        if (isLoading) return;

        const enteredOtp = otpValue || otp.join("");
        
        if (enteredOtp.length !== 6) {
            Alert.alert("Error", "Please enter complete 6-digit OTP");
            return;
        }

        setIsLoading(true);

        try {
            // Simulate API verification delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (enteredOtp === "123456") {
                // Create user data
                const userData = {
                    email: "testuser@gmail.com",
                    name: "Demo User",
                    role: "driver",
                    id: "demo_user_001"
                };

                // Call the authentication success handler from AppNavigator
                await onAuthSuccess(userData);
                
                // Success message
                Alert.alert(
                    "Success", 
                    "OTP verified successfully! Welcome to FleetGo.",
                    [{ text: "Continue", style: "default" }]
                );
            } else {
                Alert.alert(
                    "Error", 
                    "Invalid OTP. Please try 123456.",
                    [
                        {
                            text: "Try Again",
                            onPress: () => {
                                setOtp(["", "", "", "", "", ""]);
                                inputs.current[0]?.focus();
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error("OTP verification error:", error);
            Alert.alert(
                "Error", 
                "Verification failed. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0 || isLoading) return;

        setIsLoading(true);
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Reset timer and OTP
            setResendTimer(109); // Reset to 01:49
            setOtp(["", "", "", "", "", ""]);
            inputs.current[0]?.focus();
            
            Alert.alert(
                "OTP Sent", 
                "A new OTP has been sent to your email."
            );
        } catch (error) {
            console.error("Resend OTP error:", error);
            Alert.alert("Error", "Failed to resend OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                {/* Top Section */}
                <View style={styles.topSection}>
                    <Image source={logo} style={styles.logo} resizeMode="contain" />
                </View>

                {/* Bottom White Card */}
                <View style={styles.card}>
                    <Text style={styles.title}>Verification required</Text>
                    <Text style={styles.subtitle}>
                        Enter the code sent to <Text style={styles.bold}>testuser@gmail.com</Text>
                    </Text>

                    <Image source={otpImage} style={styles.image} resizeMode="contain" />

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            We highly encourage setting up an authenticator app for the highest level
                            of security. You can set up an authenticator app anytime through account
                            settings &gt; security.
                        </Text>
                    </View>

                    {/* Demo OTP Info */}
                    <View style={styles.demoBox}>
                        <Text style={styles.demoText}>
                            <Text style={styles.bold}>Demo OTP:</Text> 123456
                        </Text>
                    </View>

                    {/* OTP Inputs */}
                    <View style={styles.otpContainer}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => {
                                    if (ref) inputs.current[index] = ref;
                                }}
                                style={[
                                    styles.otpInput,
                                    digit ? styles.otpInputFilled : null
                                ]}
                                keyboardType="numeric"
                                maxLength={1}
                                value={digit}
                                onChangeText={(value) => handleChange(value, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                editable={!isLoading}
                                autoFocus={index === 0}
                            />
                        ))}
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        style={[
                            styles.verifyButton,
                            (isLoading || otp.some(digit => !digit)) && styles.verifyButtonDisabled
                        ]} 
                        onPress={() => handleVerify()}
                        disabled={isLoading || otp.some(digit => !digit)}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.verifyText}>Verify</Text>
                        )}
                    </TouchableOpacity>

                    {/* Resend Timer */}
                    {resendTimer > 0 ? (
                        <Text style={styles.resendText}>
                            Resend again in ({formatTimer(resendTimer)})
                        </Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend} disabled={isLoading}>
                            <Text style={styles.resendLink}>
                                {isLoading ? "Sending..." : "Resend OTP"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#fff" 
    },
    topSection: {
        padding: 40,
        backgroundColor: "#906AD1",
    },
    logo: {
        width: 120,
        height: 40,
    },
    card: {
        flex: 1,
        backgroundColor: "#fff",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        alignItems: "center",
        marginTop: -20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    title: { 
        fontSize: 20, 
        fontWeight: "600", 
        color: "#333", 
        marginBottom: 6 
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 16,
    },
    bold: { 
        fontWeight: "600", 
        color: "#333" 
    },
    image: { 
        width: 120, 
        height: 120, 
        marginBottom: 16 
    },
    infoBox: {
        backgroundColor: "#F8F8F8",
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    infoText: { 
        fontSize: 13, 
        color: "#444", 
        textAlign: "center" 
    },
    demoBox: {
        backgroundColor: "#E8F5E8",
        padding: 8,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#4CAF50",
    },
    demoText: {
        fontSize: 14,
        color: "#2E7D32",
        textAlign: "center",
    },
    otpContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
        width: "80%",
    },
    otpInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        width: 45,
        height: 55,
        textAlign: "center",
        fontSize: 18,
        fontWeight: "600",
        backgroundColor: "#FAFAFA",
    },
    otpInputFilled: {
        borderColor: "#906AD1",
        backgroundColor: "#F8F5FF",
    },
    verifyButton: {
        backgroundColor: "#906AD1",
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 40,
        marginBottom: 16,
        minWidth: 120,
        shadowColor: "#906AD1",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    verifyButtonDisabled: {
        backgroundColor: "#C4B5FD",
        shadowOpacity: 0,
        elevation: 0,
    },
    verifyText: { 
        color: "#fff", 
        fontWeight: "bold", 
        fontSize: 16,
        textAlign: "center",
    },
    resendText: { 
        fontSize: 14, 
        color: "#888", 
        marginBottom: 12 
    },
    resendLink: {
        fontSize: 14,
        color: "#906AD1",
        fontWeight: "600",
        textDecorationLine: "underline",
    },
});