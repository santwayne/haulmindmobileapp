import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Switch,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';

type ToggleKey = "offDuty" | "onDuty" | "serviceBreak" | "drive" | "personalBreak";

interface ToggleStates {
    offDuty: boolean;
    onDuty: boolean;
    serviceBreak: boolean;
    drive: boolean;
    personalBreak: boolean;
}

interface DayReport {
    day: string;
    date: string;
    onDutyTime: string;
    driveTime: string;
    milesCovered: number;
    status: string;
}

interface ExemptionState {
    adverse: boolean;
    breakdown: boolean;
    shortHaul: boolean;
}

const HoursOfService = () => {
    const [activeTab, setActiveTab] = useState<'main' | 'recap' | 'exemption'>('main');
    const [toggleStates, setToggleStates] = useState<ToggleStates>({
        offDuty: true,
        onDuty: false,
        serviceBreak: false,
        drive: false,
        personalBreak: false,
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const [hoursLeftToday, setHoursLeftToday] = useState('8:45');
    
    // Add state for exemption applications
    const [exemptionApplications, setExemptionApplications] = useState<ExemptionState>({
        adverse: false,
        breakdown: false,
        shortHaul: true, // Already applied as per original design
    });

    // Mock weekly data - separated weekdays and weekend
    const weekdayReports: DayReport[] = [
        { day: 'Monday', date: 'Aug 21', onDutyTime: '10:30', driveTime: '8:15', milesCovered: 425, status: 'Complete' },
        { day: 'Tuesday', date: 'Aug 22', onDutyTime: '11:00', driveTime: '9:30', milesCovered: 520, status: 'Complete' },
        { day: 'Wednesday', date: 'Aug 23', onDutyTime: '9:45', driveTime: '7:20', milesCovered: 380, status: 'Complete' },
        { day: 'Thursday', date: 'Aug 24', onDutyTime: '10:15', driveTime: '8:45', milesCovered: 460, status: 'Complete' },
        { day: 'Friday', date: 'Aug 25', onDutyTime: '8:30', driveTime: '6:15', milesCovered: 310, status: 'Complete' },
    ];

    const weekendReports: DayReport[] = [
        { day: 'Saturday', date: 'Aug 26', onDutyTime: '4:20', driveTime: '3:10', milesCovered: 180, status: 'Partial' },
        { day: 'Sunday', date: 'Aug 27', onDutyTime: '0:00', driveTime: '0:00', milesCovered: 0, status: 'Off' },
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            // Calculate hours left in today (mock calculation)
            const now = new Date();
            const endOfDay = new Date();
            endOfDay.setHours(24, 0, 0, 0);
            const diff = endOfDay.getTime() - now.getTime();
            const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
            const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setHoursLeftToday(`${hoursLeft}:${minutesLeft.toString().padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleToggle = (key: ToggleKey) => {
        const newStates: ToggleStates = {
            offDuty: false,
            onDuty: false,
            serviceBreak: false,
            drive: false,
            personalBreak: false,
        };
        newStates[key] = !toggleStates[key];
        setToggleStates(newStates);
    };

    // Add function to handle exemption applications
    const handleExemptionApplication = (exemptionType: keyof ExemptionState) => {
        setExemptionApplications(prev => ({
            ...prev,
            [exemptionType]: !prev[exemptionType]
        }));
    };

    const getToggleColor = (key: ToggleKey) => {
        switch (key) {
            case 'offDuty': return '#ff5722';
            case 'onDuty': return '#4caf50';
            case 'serviceBreak': return '#00bcd4';
            case 'drive': return '#2196f3';
            case 'personalBreak': return '#ff9800';
            default: return '#4caf50';
        }
    };

    const renderToggleRow = (label: string, key: ToggleKey, isActive: boolean) => (
        <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { fontSize: 16 }]}>{label}</Text>
            <Switch
                value={isActive}
                onValueChange={() => handleToggle(key)}
                trackColor={{
                    false: '#e0e0e0',
                    true: getToggleColor(key)
                }}
                thumbColor={isActive ? '#fff' : '#f4f3f4'}
                ios_backgroundColor="#e0e0e0"
                style={styles.largeSwitch}
            />
        </View>
    );

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'main' && styles.activeTab]}
                onPress={() => setActiveTab('main')}
            >
                <Text style={[styles.tabText, activeTab === 'main' && styles.activeTabText]}>
                    Hours of Service
                </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'recap' && styles.activeTab]}
                onPress={() => setActiveTab('recap')}
            >
                <Text style={[styles.tabText, activeTab === 'recap' && styles.activeTabText]}>
                    Cycle Recap
                </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'exemption' && styles.activeTab]}
                onPress={() => setActiveTab('exemption')}
            >
                <Text style={[styles.tabText, activeTab === 'exemption' && styles.activeTabText]}>
                    Exemptions
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderDayReportCard = (day: DayReport, index: number) => (
        <View key={index} style={styles.dayReportCard}>
            <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day.day}</Text>
                <Text style={styles.dayDate}>{day.date}</Text>
                <View style={[styles.statusBadge, 
                    day.status === 'Complete' ? styles.completeBadge : 
                    day.status === 'Partial' ? styles.partialBadge : styles.offBadge
                ]}>
                    <Text style={styles.statusText}>{day.status}</Text>
                </View>
            </View>
            <View style={styles.dayDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>On-Duty Time:</Text>
                    <Text style={styles.detailValue}>{day.onDutyTime}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Drive Time:</Text>
                    <Text style={styles.detailValue}>{day.driveTime}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Miles Covered:</Text>
                    <Text style={styles.detailValue}>{day.milesCovered} mi</Text>
                </View>
            </View>
        </View>
    );

    const renderMainContent = () => (
        <>
            <View style={styles.toggleContainer}>
                {renderToggleRow('OFF DUTY', 'offDuty', toggleStates.offDuty)}
                {renderToggleRow('ON DUTY', 'onDuty', toggleStates.onDuty)}
                {renderToggleRow('SERVICE BREAK', 'serviceBreak', toggleStates.serviceBreak)}
                {renderToggleRow('DRIVE', 'drive', toggleStates.drive)}
                {renderToggleRow('PERSONAL BREAK', 'personalBreak', toggleStates.personalBreak)}
            </View>

            <View style={styles.propertyCard}>
                <Text style={styles.propertyText}>Property 70 Hours/8days (16-Hours Exemption)</Text>
            </View>

            <View style={styles.timeContainer}>
                <Text style={styles.sectionTitle}>Hours of Service</Text>
                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>SERVICE BREAK</Text>
                    <Text style={styles.timeValue}>8:00</Text>
                </View>
                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Driving Left</Text>
                    <Text style={styles.timeValue}>11:00</Text>
                </View>
                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Workday Left</Text>
                    <Text style={styles.timeValue}>12:20</Text>
                </View>
                <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Cycle Left</Text>
                    <Text style={styles.timeValue}>11:00</Text>
                </View>
                <View style={[styles.timeRow, styles.highlightRow]}>
                    <Text style={styles.timeLabel}>Hours Left Today</Text>
                    <Text style={styles.highlightTimeValue}>{hoursLeftToday}</Text>
                </View>
            </View>
        </>
    );

    const renderCycleRecap = () => (
        <>
            <View style={styles.recapContainer}>
                <Text style={styles.recapTitle}>Weekly Cycle Report</Text>
                <Text style={styles.recapSubtitle}>Current Week: Aug 21 - Aug 27, 2025</Text>
                
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total On-Duty</Text>
                        <Text style={styles.summaryValue}>54:20</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Drive Time</Text>
                        <Text style={styles.summaryValue}>43:15</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Miles</Text>
                        <Text style={styles.summaryValue}>2,275</Text>
                    </View>
                </View>

                {/* All Reports - Simply displayed without scroll */}
                <Text style={styles.sectionHeader}>Daily Reports</Text>
                {[...weekdayReports, ...weekendReports].map((day, index) => renderDayReportCard(day, index))}
            </View>
        </>
    );

    const renderExemptions = () => (
        <View style={styles.exemptionsContainer}>
            <Text style={styles.exemptionsTitle}>Available Exemptions</Text>
            <Text style={styles.exemptionsSubtitle}>Apply for additional driving time when needed</Text>

            <View style={styles.exemptionCard}>
                <View style={styles.exemptionHeader}>
                    <Text style={styles.exemptionName}>Adverse Driving Conditions</Text>
                    <Text style={styles.exemptionTime}>+2 Hours</Text>
                </View>
                <Text style={styles.exemptionDescription}>
                    Use when encountering snow, sleet, fog, or other adverse weather conditions that weren't anticipated at dispatch.
                </Text>
                <View style={styles.exemptionActions}>
                    <TouchableOpacity 
                        style={[styles.applyButton, exemptionApplications.adverse && styles.appliedButton]}
                        onPress={() => handleExemptionApplication('adverse')}
                    >
                        <Text style={[styles.applyButtonText, exemptionApplications.adverse && styles.appliedButtonText]}>
                            {exemptionApplications.adverse ? 'Applied Today' : 'Apply for Today'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.exemptionNote}>
                        {exemptionApplications.adverse ? 'Active for this duty period' : 'Extends driving time by 2 hours'}
                    </Text>
                </View>
            </View>

            <View style={styles.exemptionCard}>
                <View style={styles.exemptionHeader}>
                    <Text style={styles.exemptionName}>Vehicle Breakdown Exception</Text>
                    <Text style={styles.exemptionTime}>+2 Hours</Text>
                </View>
                <Text style={styles.exemptionDescription}>
                    Apply when mechanical problems or vehicle breakdown prevents completion of trip within normal HOS limits.
                </Text>
                <View style={styles.exemptionActions}>
                    <TouchableOpacity 
                        style={[styles.applyButton, exemptionApplications.breakdown && styles.appliedButton]}
                        onPress={() => handleExemptionApplication('breakdown')}
                    >
                        <Text style={[styles.applyButtonText, exemptionApplications.breakdown && styles.appliedButtonText]}>
                            {exemptionApplications.breakdown ? 'Applied Today' : 'Apply for Today'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.exemptionNote}>
                        {exemptionApplications.breakdown ? 'Active for this duty period' : 'Must document breakdown details'}
                    </Text>
                </View>
            </View>

            <View style={styles.exemptionCard}>
                <View style={styles.exemptionHeader}>
                    <Text style={styles.exemptionName}>16-Hour Short-Haul Exception</Text>
                    <Text style={styles.exemptionTime}>+2 Hours</Text>
                </View>
                <Text style={styles.exemptionDescription}>
                    Available for drivers operating within 150 air-mile radius who return to work reporting location daily.
                </Text>
                <View style={styles.exemptionActions}>
                    <TouchableOpacity style={[styles.applyButton, styles.appliedButton]}>
                        <Text style={styles.appliedButtonText}>Currently Applied</Text>
                    </TouchableOpacity>
                    <Text style={styles.exemptionNote}>Active for this duty period</Text>
                </View>
            </View>

            <View style={styles.exemptionHistory}>
                <Text style={styles.historyTitle}>Recent Exemptions</Text>
                <View style={styles.historyItem}>
                    <Text style={styles.historyDate}>Aug 24, 2025</Text>
                    <Text style={styles.historyType}>Adverse Weather - Snow</Text>
                    <Text style={styles.historyDuration}>+2:00 hours</Text>
                </View>
                <View style={styles.historyItem}>
                    <Text style={styles.historyDate}>Aug 18, 2025</Text>
                    <Text style={styles.historyType}>Vehicle Breakdown</Text>
                    <Text style={styles.historyDuration}>+1:30 hours</Text>
                </View>
            </View>
        </View>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'recap':
                return renderCycleRecap();
            case 'exemption':
                return renderExemptions();
            default:
                return renderMainContent();
        }
    };

    return (
        <ScrollView 
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
        >
            <View style={styles.header}>
                <Text style={styles.headerText}>Hours of Service Management</Text>
                <Text style={styles.headerSubText}>
                    {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}
                </Text>
            </View>

            {renderTabs()}
            {renderContent()}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 30,
    },
    header: {
        backgroundColor: '#906AD1',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
    },
    headerText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 5,
    },
    headerSubText: {
        color: '#bdc3c7',
        fontSize: 14,
        fontWeight: '400',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 20,
        padding: 4,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#3498db',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7f8c8d',
        textAlign: 'center',
    },
    activeTabText: {
        color: 'white',
    },
    toggleContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 20,
        paddingVertical: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        flex: 1,
    },
    largeSwitch: {
        transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
    },
    propertyCard: {
        backgroundColor: '#906AD1',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 20,
        elevation: 2,
    },
    propertyText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    timeContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 20,
        paddingVertical: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2c3e50',
        paddingHorizontal: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
        marginBottom: 10,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    highlightRow: {
        backgroundColor: '#e8f5e8',
        marginHorizontal: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    timeLabel: {
        fontSize: 14,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    timeValue: {
        fontSize: 15,
        color: '#2c3e50',
        fontWeight: '700',
    },
    highlightTimeValue: {
        fontSize: 15,
        color: '#27ae60',
        fontWeight: '700',
    },
    // Cycle Recap Styles - Fixed scrolling
    recapContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        flex: 1,
    },
    recapTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 5,
    },
    recapSubtitle: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 20,
    },
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 5,
        textAlign: 'center',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2c3e50',
    },
    // Section headers
    sectionHeader: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 15,
        marginTop: 10,
    },
    dayReportCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#3498db',
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dayName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
    },
    dayDate: {
        fontSize: 14,
        color: '#7f8c8d',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    completeBadge: {
        backgroundColor: '#d5f5d5',
    },
    partialBadge: {
        backgroundColor: '#fff3cd',
    },
    offBadge: {
        backgroundColor: '#f8d7da',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2c3e50',
    },
    dayDetails: {
        gap: 5,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 13,
        color: '#7f8c8d',
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2c3e50',
    },
    // Exemptions Styles
    exemptionsContainer: {
        gap: 15,
    },
    exemptionsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 5,
    },
    exemptionsSubtitle: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 15,
    },
    exemptionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    exemptionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    exemptionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        flex: 1,
    },
    exemptionTime: {
        fontSize: 14,
        fontWeight: '700',
        color: '#e74c3c',
        backgroundColor: '#fdeaea',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    exemptionDescription: {
        fontSize: 13,
        color: '#7f8c8d',
        lineHeight: 18,
        marginBottom: 15,
    },
    exemptionActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    applyButton: {
        backgroundColor: '#27ae60',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    appliedButton: {
        backgroundColor: '#95a5a6',
    },
    applyButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    appliedButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    exemptionNote: {
        fontSize: 11,
        color: '#7f8c8d',
        flex: 1,
        textAlign: 'right',
        marginLeft: 10,
    },
    exemptionHistory: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 10,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    historyDate: {
        fontSize: 12,
        color: '#7f8c8d',
        width: 80,
    },
    historyType: {
        fontSize: 12,
        color: '#2c3e50',
        flex: 1,
        fontWeight: '500',
    },
    historyDuration: {
        fontSize: 12,
        color: '#e74c3c',
        fontWeight: '600',
    },
});

export default HoursOfService;