import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DVIRInspection = ({ }) => {
    const navigation = useNavigation<NavigationProp>();
    const [remark, setRemark] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isCertifying, setIsCertifying] = useState(false);

    const handleCertify = async () => {
        if (isCertifying) return;

        setIsCertifying(true);

        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            setShowSuccessModal(true);

            // Auto hide modal after 3 seconds
            setTimeout(() => {
                setShowSuccessModal(false);
            }, 3000);

        } catch (error) {
            Alert.alert('Error', 'Failed to certify inspection. Please try again.');
        } finally {
            setIsCertifying(false);
        }
    };

    const navigateToNewTrip = () => {
        setShowSuccessModal(false);
        // Navigate to NewTrip screen
        navigation.navigate('NewTrip');
    };

    const addNewInspection = () => {
        setShowSuccessModal(false);
        // Reset form or navigate to new inspection
        setRemark('');
        // You could also navigate to a new inspection form here
        // navigation.navigate('NewInspection');
    };

    return (
        <>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerText}>Cascadio : S.No : 1253566</Text>
                    <Text style={styles.headerSub}>👁 Need Review</Text>
                </View>

                {/* Top Details */}
                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Centre Name</Text>
                        <Text style={styles.value}>Canada, GHA</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Carrier Address</Text>
                        <Text style={styles.value}>Canada, 105 Shrinking, GHA</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Date</Text>
                        <Text style={styles.value}>August 28, 2025 - 2:45 PM</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Inspection Location</Text>
                        <Text style={styles.value}>105 Aberdeen Road, Canada</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Inspection Type</Text>
                        <Text style={styles.value}>Pre Trip</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Asset Type</Text>
                        <Text style={styles.value}>Vehicle</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Unit Number</Text>
                        <Text style={styles.value}>Cascadio : S.No : 1253566</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Signed By</Text>
                        <Text style={styles.value}>Morgan</Text>
                    </View>
                </View>

                {/* Information */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Information</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>VIN</Text>
                        <Text style={styles.value}>kidgn165464</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Trainer</Text>
                        <Text style={styles.value}>None</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Inspector Name</Text>
                        <Text style={styles.value}>Morgan</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Operator</Text>
                        <Text style={styles.value}>Morgan</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Home Terminal</Text>
                        <Text style={styles.value}>Above Care Logistics</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Home Terminal</Text>
                        <Text style={styles.value}>105 Shrinking Spring</Text>
                    </View>
                </View>

                {/* Driver Certification */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Driver Certification</Text>
                </View>
                <View style={styles.card}>
                    <TextInput
                        style={styles.remarkInput}
                        placeholder="Add a Remark"
                        placeholderTextColor="#aaa"
                        multiline
                        value={remark}
                        onChangeText={setRemark}
                    />
                </View>

                {/* Certify Button */}
                <TouchableOpacity
                    style={[styles.button, isCertifying && styles.buttonDisabled]}
                    onPress={handleCertify}
                    disabled={isCertifying}
                >
                    <Text style={styles.buttonText}>
                        {isCertifying ? 'Certifying...' : 'Certify Previous Inspection'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.successIcon}>
                            <Text style={styles.checkmark}>✓</Text>
                        </View>

                        <Text style={styles.successTitle}>Inspection Certified Successfully!</Text>
                        <Text style={styles.successMessage}>
                            Your DVIR inspection has been certified and saved to the system.
                        </Text>

                        <View style={styles.modalButtonContainer}>


                            <TouchableOpacity
                                style={[styles.modalButton, styles.primaryModalButton]}
                                onPress={navigateToNewTrip}
                            >
                                <Text style={[styles.modalButtonText, styles.primaryModalButtonText]}>
                                    Add New Inspection
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowSuccessModal(false)}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 30,
    },
    header: {
        backgroundColor: '#9575cd',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    headerSub: {
        color: 'white',
        fontSize: 14,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#555',
        fontWeight: '500',
    },
    value: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'right',
    },
    sectionHeader: {
        backgroundColor: '#9575cd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    sectionTitle: {
        color: 'white',
        fontSize: 15,
        fontWeight: '600',
    },
    remarkInput: {
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#333',
    },
    button: {
        backgroundColor: '#e91e63',
        paddingVertical: 15,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
        elevation: 0,
        shadowOpacity: 0,
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        maxWidth: 350,
        width: '100%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    checkmark: {
        color: 'white',
        fontSize: 40,
        fontWeight: 'bold',
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    modalButtonContainer: {
        flexDirection: 'column',
        width: '100%',
        gap: 12,
    },
    modalButton: {
        backgroundColor: '#f5f5f5',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 8,
        width: '100%',
    },
    primaryModalButton: {
        backgroundColor: '#9575cd',
    },
    modalButtonText: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    primaryModalButtonText: {
        color: 'white',
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
    },
});

export default DVIRInspection;