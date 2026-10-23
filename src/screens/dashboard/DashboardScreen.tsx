import React, { useState, useEffect } from "react";
import { useFocusEffect, useRoute } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    useWindowDimensions,
    ActivityIndicator,
    RefreshControl,
    Linking,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";

const activeTrip  = require("../../../assets/icons/active trip.png");
const completeTrip = require("../../../assets/icons/complete trip.png");
const pendingTrip  = require("../../../assets/icons/pending trip.png");

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiService } from '../../services/api/apiService';
import { authManager } from '../../types/AuthManager';
import { logger } from '../../utils/loggerHelper';

// ─── Global Theme ─────────────────────────────────────────────────────────────
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DriverProfile {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    profileImageUrl?: string;
    profileImage?: string;
    status?: string;
    details?: {
        internalId?: string;
        licenceNumber?: string;
    };
}

interface LoadStats {
    active: number;
    pending: number;
    accepted: number;
    completed: number;
    totalMiles: number;
}

// ─── Trip stat card config ────────────────────────────────────────────────────
const STAT_CARDS = [
    {
        key: 'active',
        label: 'Active Trips',
        icon: activeTrip,
        isImage: true,
        accentColor: COLORS.accentBlue,
        route: 'ActiveTrips' as keyof RootStackParamList,
    },
    {
        key: 'completed',
        label: 'Completed Trips',
        icon: completeTrip,
        isImage: true,
        accentColor: COLORS.accentGreen,
        route: 'CompleteTrips' as keyof RootStackParamList,
    },
    {
        key: 'pending',
        label: 'Assignment Requests',
        icon: null,
        ionicon: 'notifications' as const,
        isImage: false,
        accentColor: COLORS.accentOrange,
        route: 'PendingTrips' as keyof RootStackParamList,
        routeParams: { initialTab: 'requests' as const },
        hasBadge: true,
    },
    {
        key: 'accepted',
        label: 'Accepted Trips',
        icon: null,
        ionicon: 'checkmark-circle' as const,
        isImage: false,
        accentColor: COLORS.accentTeal,
        route: 'PendingTrips' as keyof RootStackParamList,
        routeParams: { initialTab: 'accepted' as const },
    },
];

export default function DashboardScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { width } = useWindowDimensions();
    const isTablet  = width >= 600;

    // Responsive sizing
    const avatarSize      = isTablet ? 100 : 78;
    const taskIconSize    = isTablet ? 50  : 40;
    const taskIconImg     = isTablet ? 26  : 22;
    const taskIonIcon     = isTablet ? 24  : 20;
    const wishItemW       = (width - 60) / (isTablet ? 5 : 3.5);
    const wishItemGridW   = (width - 80) / (isTablet ? 5 : 3);
    const wishIcon        = isTablet ? 32  : 26;
    const [showAllWishList, setShowAllWishList] = useState(false);
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [stats, setStats] = useState<LoadStats>({
        active: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        totalMiles: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const callNumber = (phone: string) => {
        const url = `tel:${phone.replace(/\s+/g, '')}`;
        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert('Call Failed', `Cannot place a call to ${phone}`);
            }
        });
    };

    const handleCallDispatch = async () => {
        try {
            const res = await apiService.getCompanyDispatchers();
            if (!res.success) {
                Alert.alert('Error', res.error || 'Failed to fetch dispatcher information.');
                return;
            }
            const rawData = res.data as any;
            const dispatchers: Array<{ _id: string; name: string; phone?: string; email?: string }> =
                Array.isArray(rawData?.data) ? rawData.data :
                Array.isArray(rawData) ? rawData : [];
            const withPhone = dispatchers.filter(d => !!d.phone);
            if (withPhone.length === 0) {
                Alert.alert('No Dispatcher', 'No dispatcher with a phone number found. Please contact your administrator.');
                return;
            }
            if (withPhone.length === 1) {
                callNumber(withPhone[0].phone!);
                return;
            }
            const buttons: any[] = withPhone.map(d => ({
                text: `${d.name} — ${d.phone}`,
                onPress: () => callNumber(d.phone!),
            }));
            buttons.push({ text: 'Cancel', style: 'cancel' });
            Alert.alert('Call Dispatcher', 'Select a dispatcher:', buttons);
        } catch (error: any) {
            console.error('handleCallDispatch error:', error);
            Alert.alert('Error', `Failed to load dispatchers: ${error?.message || 'Unknown error'}`);
        }
    };

    const wishListItems = [
        { id: 1, name: "Chat",          icon: <Ionicons name="chatbubbles"     size={26} color="#fff" />, color: "#00C2A6", route: "DriverChat" },
        { id: 2, name: "Settings",      icon: <Ionicons name="settings"        size={26} color="#fff" />, color: "#2CDBFA", route: "Settings" },
        { id: 3, name: "Load Map",      icon: <Ionicons name="map"             size={26} color="#fff" />, color: "#831775", route: "LoadMap" },
        { id: 4, name: "Verification",  icon: <Ionicons name="shield-checkmark" size={26} color="#fff" />, color: "#0ea3d8", route: "OnboardingGuard" },
        { id: 5, name: "ELD Documents", icon: <Ionicons name="document-text"   size={26} color="#fff" />, color: "#8B5CF6", route: "ELDDocuments" },
        { id: 6, name: "Mileage Sheet", icon: <Ionicons name="speedometer"     size={26} color="#fff" />, color: "#FF6B35", route: "MileageSheet" },
        { id: 7, name: "Call Dispatch", icon: <Ionicons name="call"            size={26} color="#fff" />, color: "#16a34a", onPress: handleCallDispatch },
    ];

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const lastRefreshRef = React.useRef<number>(0);
    const REFRESH_DEBOUNCE_MS = 500;

    const refreshDashboardIfNeeded = React.useCallback(() => {
        const now = Date.now();
        if (now - lastRefreshRef.current > REFRESH_DEBOUNCE_MS) {
            lastRefreshRef.current = now;
            logger.info('Dashboard refresh triggered');
            fetchDashboardData();
        } else {
            logger.info('Dashboard refresh skipped (too soon since last refresh)');
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            refreshDashboardIfNeeded();
        }, [refreshDashboardIfNeeded])
    );

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setTimeout(() => { refreshDashboardIfNeeded(); }, 200);
        });
        return unsubscribe;
    }, [navigation, refreshDashboardIfNeeded]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [profileRes, activeRes, requestsRes, acceptedRes, completedRes] = await Promise.allSettled([
                apiService.getProfile(),
                apiService.getActiveTrips(),
                apiService.getAssignmentRequests(),
                apiService.getPendingTrips(),
                apiService.getCompletedTrips(),
            ]);

            if (profileRes.status === 'fulfilled' && profileRes.value.success && profileRes.value.data) {
                const driverData = profileRes.value.data?.data || profileRes.value.data;
                setProfile(driverData);
                const currentUser = authManager.getCurrentUser();
                if (currentUser) {
                    await authManager.updateUserData({
                        name: driverData.name || currentUser.name,
                        email: driverData.email || currentUser.email,
                    });
                }
            } else {
                const currentUser = authManager.getCurrentUser();
                if (currentUser) {
                    setProfile({ _id: currentUser.id, name: currentUser.name, email: currentUser.email });
                }
            }

            const newStats: LoadStats = {
                active:    activeRes.status    === 'fulfilled' && activeRes.value.success    ? activeRes.value.data?.count    || activeRes.value.data?.data?.length    || 0 : 0,
                pending:   requestsRes.status  === 'fulfilled' && requestsRes.value.success  ? requestsRes.value.data?.count  || requestsRes.value.data?.data?.length  || 0 : 0,
                accepted:  acceptedRes.status  === 'fulfilled' && acceptedRes.value.success  ? acceptedRes.value.data?.count  || acceptedRes.value.data?.data?.length  || 0 : 0,
                completed: completedRes.status === 'fulfilled' && completedRes.value.success ? completedRes.value.data?.count || completedRes.value.data?.data?.length || 0 : 0,
                totalMiles: 0,
            };
            setStats(newStats);
            logger.info('Dashboard data loaded', { hasProfile: !!profile, stats: newStats });
        } catch (error) {
            logger.error('Failed to fetch dashboard data', error);
            const currentUser = authManager.getCurrentUser();
            if (currentUser) {
                setProfile({ _id: currentUser.id, name: currentUser.name, email: currentUser.email });
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const handleWishItemPress = (item: any) => {
        if (item.onPress) { item.onPress(); return; }
        if (item.route) { navigation.navigate(item.route as any); }
    };

    // ─── Render helpers ────────────────────────────────────────────────────────

    const renderWishItem = (item: any, isGrid: boolean = false) => (
        <TouchableOpacity
            key={item.id}
            style={[
                styles.wishItem,
                { backgroundColor: item.color, width: isGrid ? wishItemGridW : wishItemW },
                isGrid && styles.wishItemGrid,
            ]}
            onPress={() => handleWishItemPress(item)}
            activeOpacity={0.75}
        >
            <View style={styles.iconWrapper}>
                {React.cloneElement(item.icon, { size: wishIcon })}
            </View>
            <Text style={[styles.wishText, isGrid && styles.wishTextGrid, isTablet && styles.wishTextTablet]} numberOfLines={2}>
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    const renderHorizontalWishList = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
            bounces={false}
        >
            {wishListItems.map((item) => renderWishItem(item, false))}
        </ScrollView>
    );

    const renderGridWishList = () => {
        const itemsPerRow = 3;
        const rows = [];
        for (let i = 0; i < wishListItems.length; i += itemsPerRow) {
            const rowItems = wishListItems.slice(i, i + itemsPerRow);
            rows.push(
                <View key={i} style={styles.wishGrid}>
                    {rowItems.map((item) => renderWishItem(item, true))}
                    {rowItems.length < itemsPerRow &&
                        Array.from({ length: itemsPerRow - rowItems.length }).map((_, idx) => (
                            <View key={`empty-${idx}`} style={styles.wishItemGrid} />
                        ))
                    }
                </View>
            );
        }
        return <View style={styles.wishGridContainer}>{rows}</View>;
    };

    const getStatValue = (key: string) => stats[key as keyof LoadStats] as number;

    // ─── Main render ───────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.accentBlue]}
                        tintColor={COLORS.accentBlue}
                    />
                }
            >
                <View style={styles.content}>

                    {/* ── Loading skeleton ─────────────────────────────────── */}
                    {loading && !profile ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.accentBlue} />
                            <Text style={styles.loadingText}>Loading dashboard…</Text>
                        </View>
                    ) : (

                        /* ── Profile Card ────────────────────────────────────── */
                        <View style={styles.profileCard}>
                            {/* Subtle neon glow line at top */}
                            <View style={styles.profileGlowBar} />

                            <View style={styles.profileContent}>
                                <View style={styles.profileInfo}>
                                    <Text style={styles.driverLabel}>Driver</Text>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.driverName, isTablet && styles.driverNameTablet]} numberOfLines={1}>
                                            {profile?.name || authManager.getCurrentUser()?.name || 'Driver'}
                                        </Text>
                                        <View style={styles.statusBadge}>
                                            <View style={styles.statusDot} />
                                            <Text style={styles.statusText}>
                                                {profile?.status || 'Active'}
                                            </Text>
                                        </View>
                                    </View>

                                    {profile?.details?.internalId && (
                                        <Text style={styles.internalIdLabel}>
                                            ID: {profile.details.internalId}
                                        </Text>
                                    )}

                                    <Text style={styles.tripLabel}>Total Loads</Text>
                                    <Text style={styles.totalLoads}>
                                        {stats.active + stats.pending + stats.accepted + stats.completed}
                                    </Text>
                                </View>

                                {(profile?.profileImage || profile?.profileImageUrl) ? (
                                    <Image
                                        source={{ uri: profile.profileImage || profile.profileImageUrl }}
                                        style={[styles.avatar, { width: avatarSize, height: avatarSize }]}
                                    />
                                ) : (
                                    <View style={[styles.avatar, styles.avatarPlaceholder, { width: avatarSize, height: avatarSize }]}>
                                        <Ionicons name="person" size={Math.round(avatarSize * 0.48)} color={COLORS.accentBlue} />
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* ── Stat Cards ──────────────────────────────────────────── */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Trip Overview</Text>
                        </View>

                        <View style={styles.taskContainer}>
                            {STAT_CARDS.map((card, idx) => {
                                const value = getStatValue(card.key);
                                const isLast = idx === STAT_CARDS.length - 1;
                                return (
                                    <TouchableOpacity
                                        key={card.key}
                                        style={[styles.taskCard, isLast && styles.taskCardLast]}
                                        onPress={() => navigation.navigate(card.route as any, (card as any).routeParams)}
                                        activeOpacity={0.75}
                                    >
                                        {/* Accent left border */}
                                        <View style={[styles.taskAccentBar, { backgroundColor: card.accentColor }]} />

                                        {/* Icon */}
                                        <View style={[styles.taskIconContainer, { width: taskIconSize, height: taskIconSize, backgroundColor: `${card.accentColor}22` }]}>
                                            {card.isImage ? (
                                                <Image source={card.icon} style={[styles.taskIcon, { width: taskIconImg, height: taskIconImg, tintColor: card.accentColor }]} />
                                            ) : (
                                                <Ionicons name={card.ionicon!} size={taskIonIcon} color={card.accentColor} />
                                            )}
                                        </View>

                                        {/* Label + count */}
                                        <View style={styles.taskContent}>
                                            <Text style={[styles.taskText, isTablet && styles.taskTextTablet]}>{card.label}</Text>
                                            <View style={styles.taskCountRow}>
                                                <Text style={[styles.taskCount, isTablet && styles.taskCountTablet, { color: card.accentColor }]}>
                                                    {value}
                                                </Text>
                                                {(card as any).hasBadge && value > 0 && (
                                                    <Text style={[styles.awaitingLabel, isTablet && styles.awaitingLabelTablet]}> awaiting</Text>
                                                )}
                                            </View>
                                        </View>

                                        {/* Pending badge */}
                                        {(card as any).hasBadge && value > 0 && (
                                            <View style={[styles.pendingBadge, { backgroundColor: card.accentColor }]}>
                                                <Text style={styles.pendingBadgeText}>{value}</Text>
                                            </View>
                                        )}

                                        <Ionicons name="chevron-forward" size={isTablet ? 20 : 16} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* ── Quick Access ────────────────────────────────────────── */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Quick Access</Text>
                            <TouchableOpacity onPress={() => setShowAllWishList(!showAllWishList)}>
                                <Text style={styles.linkText}>
                                    {showAllWishList ? "Collapse" : "See All"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showAllWishList ? renderGridWishList() : renderHorizontalWishList()}
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

    // Layout
    container: {
        flex: 1,
        backgroundColor: COLORS.bgMain,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 80,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.base,
        paddingTop: SPACING.base,
    },

    // ── Loading ──────────────────────────────────────────────────────────────
    loadingContainer: {
        paddingVertical: SPACING['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.base,
        color: COLORS.textSecondary,
    },

    // ── Profile Card ─────────────────────────────────────────────────────────
    profileCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.base,
        marginBottom: SPACING.base,
        borderWidth: 1,
        borderColor: COLORS.borderGlow,
        overflow: 'hidden',
        // shadow
        shadowColor: COLORS.accentBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
    },
    profileGlowBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: COLORS.accentBlue,
        opacity: 0.7,
    },
    profileContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    profileInfo: {
        flex: 1,
        paddingRight: SPACING.md,
    },
    driverLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: SPACING.xs,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    driverName: {
        fontSize: FONT_SIZE.xl,
        color: COLORS.textPrimary,
        fontWeight: FONT_WEIGHT.bold,
        flexShrink: 1,
    },
    driverNameTablet: {
        fontSize: FONT_SIZE['2xl'],
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,255,163,0.12)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.accentGreen,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.accentGreen,
    },
    statusText: {
        color: COLORS.accentGreen,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        textTransform: 'capitalize',
    },
    internalIdLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.xs,
        marginBottom: SPACING.sm,
    },
    tripLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.xs,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    totalLoads: {
        color: COLORS.accentBlue,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
    },
    avatar: {
        width: 78,
        height: 78,
        borderRadius: RADIUS.lg,
        borderWidth: 2,
        borderColor: COLORS.accentBlue,
    },
    avatarPlaceholder: {
        backgroundColor: 'rgba(0,209,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Section ──────────────────────────────────────────────────────────────
    section: {
        marginBottom: SPACING.base,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.accentNavyBlue,
    },
    linkText: {
        color: COLORS.accentBlue,
        fontWeight: FONT_WEIGHT.medium,
        fontSize: FONT_SIZE.sm,
    },

    // ── Task / Stat Cards ────────────────────────────────────────────────────
    taskContainer: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderSubtle,
    },
    taskCardLast: {
        borderBottomWidth: 0,
    },
    taskAccentBar: {
        width: 3,
        height: 36,
        borderRadius: RADIUS.full,
        marginRight: SPACING.md,
    },
    taskIconContainer: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    taskIcon: {
        width: 22,
        height: 22,
    },
    taskContent: {
        flex: 1,
    },
    taskText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    taskTextTablet: {
        fontSize: FONT_SIZE.base,
    },
    taskCountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    taskCount: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    taskCountTablet: {
        fontSize: FONT_SIZE['2xl'],
    },
    awaitingLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    awaitingLabelTablet: {
        fontSize: FONT_SIZE.sm,
    },
    pendingBadge: {
        borderRadius: RADIUS.full,
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xs + 2,
        marginRight: SPACING.sm,
    },
    pendingBadgeText: {
        color: COLORS.black,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },

    // ── Wish / Quick Access ──────────────────────────────────────────────────
    horizontalScrollContent: {
        paddingRight: SPACING.base,
        paddingVertical: SPACING.xs,
    },
    wishGridContainer: {
        paddingVertical: SPACING.xs,
    },
    wishGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
        paddingHorizontal: 2,
    },
    wishItem: {
        // width is set dynamically via inline style (wishItemW)
        minWidth: 86,
        aspectRatio: 1,
        borderRadius: RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        marginRight: SPACING.md,
        // shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
    },
    wishItemGrid: {
        // width is set dynamically via inline style (wishItemGridW)
        minWidth: 96,
        marginRight: SPACING.sm,
        marginLeft: 0,
    },
    iconWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    wishText: {
        color: COLORS.white,
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        fontWeight: FONT_WEIGHT.semibold,
        textAlign: 'center',
        paddingHorizontal: 2,
    },
    wishTextGrid: {
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.sm,
    },
    wishTextTablet: {
        fontSize: FONT_SIZE.base,
        marginTop: SPACING.sm,
    },
});
