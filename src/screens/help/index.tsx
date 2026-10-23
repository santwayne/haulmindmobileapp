// src/screens/help/index.js
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const helpSections = [
    {
        id: '1',
        title: 'Getting Started',
        icon: 'play-circle-outline',
        items: [
            'How to log in to your account',
            'Setting up your profile',
            'Understanding the dashboard',
            'First trip setup guide'
        ]
    },
    {
        id: '2',
        title: 'Trip Management',
        icon: 'car-outline',
        items: [
            'Creating a new trip',
            'Managing active trips',
            'Completing trip documentation',
            'Trip status updates'
        ]
    },
    {
        id: '3',
        title: 'Vehicle & Trailer',
        icon: 'build-outline',
        items: [
            'Vehicle inspection checklist',
            'Trailer attachment procedures',
            'Maintenance scheduling',
            'Fuel management'
        ]
    },
    {
        id: '4',
        title: 'Hours of Service (HOS)',
        icon: 'time-outline',
        items: [
            'Understanding HOS regulations',
            'Logging duty status changes',
            'Break and rest requirements',
            'Violation prevention'
        ]
    },
    {
        id: '5',
        title: 'Documents & Compliance',
        icon: 'document-text-outline',
        items: [
            'Required documentation',
            'Digital document storage',
            'Compliance reporting',
            'Document expiration alerts'
        ]
    }
];



export default function HelpScreen({ }) {
    const navigation = useNavigation<NavigationProp>();
    const [expandedSection, setExpandedSection] = useState(null);

    const toggleSection = (sectionId: any) => {
        setExpandedSection(expandedSection === sectionId ? null : sectionId);
    };



    const renderHelpSection = (section: any) => (
        <View key={section.id} style={styles.sectionContainer}>
            <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
            >
                <View style={styles.sectionTitleContainer}>
                    <Ionicons name={section.icon} size={20} color={COLORS.accentNavyBlue} />
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Ionicons
                    name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6B7280"
                />
            </TouchableOpacity>

            {expandedSection === section.id && (
                <View style={styles.sectionContent}>
                    {section.items.map((item: any, index: any) => (
                        <TouchableOpacity key={index} style={styles.helpItem}>
                            <Text style={styles.helpItemText}>• {item}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );


    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Help & Support</Text>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>


                    {/* FAQ Sections */}
                    <View style={styles.faqContainer}>
                        <Text style={styles.sectionHeaderTitle}>Frequently Asked Questions</Text>
                        {helpSections.map(renderHelpSection)}
                    </View>

                    {/* App Info */}
                    <View style={styles.appInfoContainer}>
                        <Text style={styles.sectionHeaderTitle}>App Information</Text>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Version</Text>
                            <Text style={styles.infoValue}>1.0.0</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Last Updated</Text>
                            <Text style={styles.infoValue}>August 2025</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Build Number</Text>
                            <Text style={styles.infoValue}>100.1.0</Text>
                        </View>
                    </View>

                </ScrollView>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgMain,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40, // Add padding to account for footer
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        flex: 1,
        textAlign: 'left',
        marginRight: 40,
    },
    content: {
        flex: 1,
    },
    quickSupportContainer: {
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 12,
        padding: 16,
    },
    sectionHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    supportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    supportIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    supportContent: {
        flex: 1,
    },
    supportTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    supportSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    faqContainer: {
        backgroundColor: COLORS.bgCardLight,
        margin: 16,
        marginTop: 0,
        borderRadius: 12,
        padding: 16,
    },
    sectionContainer: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginLeft: 8,
    },
    sectionContent: {
        paddingLeft: 32,
        paddingBottom: 8,
    },
    helpItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    helpItemText: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
        lineHeight: 20,
    },
    appInfoContainer: {
        backgroundColor: COLORS.bgCardLight,
        margin: 16,
        marginTop: 0,
        borderRadius: 12,
        padding: 16,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.accentNavyBlue,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    emergencyContainer: {
        backgroundColor: '#FEF2F2',
        margin: 16,
        marginTop: 0,
        marginBottom: 32,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    emergencyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    emergencyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#DC2626',
        marginLeft: 8,
    },
    emergencyText: {
        fontSize: 14,
        color: '#7F1D1D',
        marginBottom: 12,
        lineHeight: 20,
    },
    emergencyButton: {
        backgroundColor: '#DC2626',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    emergencyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    fleetEmergencyButton: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#DC2626',
    },
    fleetEmergencyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#DC2626',
    },
});