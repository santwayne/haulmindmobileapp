import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/AppNavigator";
import { AuthService } from "../../navigation/AppNavigator";
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from "../../theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FooterProps {
  onLogout?: () => void;
  navigation?: any;
}

// Tab definitions
const TABS = [
  { key: "Trips",         label: "Trips",         icon: "timer-outline"          as const },
  { key: "Search",        label: "Search",        icon: "search-outline"         as const },
  { key: "__home__",      label: "",              icon: "home"                   as const }, // spacer for center button
  { key: "Notifications", label: "Notifications", icon: "notifications-outline"  as const },
  { key: "More",          label: "More",          icon: "ellipsis-horizontal"    as const },
] as const;

export default function Footer({ onLogout }: FooterProps) {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Responsive scaling
  const iconSize  = isTablet ? 27 : 22;
  const btnSize   = isTablet ? 66 : 56;
  const ringSize  = btnSize + 10;
  const barHeight = isTablet ? 78 : 66;
  const btnBottom = isTablet ? 24 : 22;

  // Derive active tab from current route name
  const currentRoute = route.name;

  const isActive = (key: string) => {
    if (key === "Trips")         return currentRoute === "Trips"         || currentRoute === "TripInfo";
    if (key === "Search")        return currentRoute === "Search";
    if (key === "Notifications") return currentRoute === "Notifications";
    return false;
  };

  const handleTripsNavigation       = () => navigation.navigate("Trips");
  const handleSearchNavigation      = () => navigation.navigate("Search");
  const handleDashboardNavigation   = () => navigation.navigate("MainTabs", { screen: "Dashboard" });
  const handleNotificationsNavigation = () => navigation.navigate("Notifications");
  const handleMorePress             = () => setShowMoreMenu(!showMoreMenu);

  const handleHelpPress = () => {
    setShowMoreMenu(false);
    navigation.navigate("Help");
  };

  const handleLogoutPress = () => {
    setShowMoreMenu(false);
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      if (onLogout && typeof onLogout === "function") {
        onLogout();
      } else {
        await AuthService.clearAuth();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  const cancelLogout = () => setShowLogoutModal(false);

  const tabColor = (key: string) =>
    isActive(key) ? COLORS.accentBlue : COLORS.textSecondary;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      {/* Top glow line */}
      <View style={styles.glowLine} />

      <View style={[styles.footer, { height: barHeight }]}>
        {/* Trips */}
        <TouchableOpacity style={styles.tab} onPress={handleTripsNavigation} activeOpacity={0.7}>
          <Ionicons name="timer-outline" size={iconSize} color={tabColor("Trips")} />
          <Text style={[styles.tabText, isActive("Trips") && styles.tabTextActive, isTablet && styles.tabTextTablet]}>Trips</Text>
          {isActive("Trips") && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity style={styles.tab} onPress={handleSearchNavigation} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={iconSize} color={tabColor("Search")} />
          <Text style={[styles.tabText, isActive("Search") && styles.tabTextActive, isTablet && styles.tabTextTablet]}>Search</Text>
          {isActive("Search") && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* Center spacer for floating button */}
        <View style={styles.centerSpacer} />

        {/* Notifications */}
        <TouchableOpacity style={styles.tab} onPress={handleNotificationsNavigation} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={iconSize} color={tabColor("Notifications")} />
          <Text style={[styles.tabText, isActive("Notifications") && styles.tabTextActive, isTablet && styles.tabTextTablet]}>
            Notifications
          </Text>
          {isActive("Notifications") && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity style={styles.tab} onPress={handleMorePress} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={iconSize} color={COLORS.textSecondary} />
          <Text style={[styles.tabText, isTablet && styles.tabTextTablet]}>More</Text>
        </TouchableOpacity>

        {/* Floating center Home button */}
        <TouchableOpacity
          style={[
            styles.centerButton,
            {
              width: btnSize,
              height: btnSize,
              borderRadius: btnSize / 2,
              left: width / 2 - btnSize / 2,
              bottom: btnBottom,
            },
          ]}
          onPress={handleDashboardNavigation}
          activeOpacity={0.8}
        >
          {/* Outer glow ring */}
          <View style={[styles.centerButtonRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
          <Ionicons name="home" size={isTablet ? 30 : 26} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* ── More Menu ──────────────────────────────────────────────────────── */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenu}>
            {/* Glow accent top */}
            <View style={styles.moreMenuGlow} />

            <TouchableOpacity style={[styles.menuItem, isTablet && styles.menuItemTablet]} onPress={handleHelpPress} activeOpacity={0.7}>
              <View style={[styles.menuIconBox, isTablet && styles.menuIconBoxTablet, { backgroundColor: "rgba(0,209,255,0.1)" }]}>
                <Ionicons name="help-circle-outline" size={isTablet ? 22 : 18} color={COLORS.accentBlue} />
              </View>
              <Text style={[styles.menuItemText, isTablet && styles.menuItemTextTablet]}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={isTablet ? 17 : 14} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={[styles.menuItem, isTablet && styles.menuItemTablet]} onPress={handleLogoutPress} activeOpacity={0.7}>
              <View style={[styles.menuIconBox, isTablet && styles.menuIconBoxTablet, { backgroundColor: "rgba(244,63,94,0.1)" }]}>
                <Ionicons name="log-out-outline" size={isTablet ? 22 : 18} color={COLORS.accentRed} />
              </View>
              <Text style={[styles.menuItemText, isTablet && styles.menuItemTextTablet, { color: COLORS.accentRed }]}>Logout</Text>
              <Ionicons name="chevron-forward" size={isTablet ? 17 : 14} color={COLORS.accentRed} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Logout Confirmation Modal ──────────────────────────────────────── */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="slide"
        onRequestClose={cancelLogout}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            {/* Top glow line */}
            <View style={styles.logoutModalGlow} />

            <View style={styles.modalHeader}>
              <View style={[styles.warningIconBox, isTablet && styles.warningIconBoxTablet]}>
                <Ionicons name="warning-outline" size={isTablet ? 36 : 28} color={COLORS.accentOrange} />
              </View>
              <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>Confirm Logout</Text>
            </View>

            <Text style={[styles.modalMessage, isTablet && styles.modalMessageTablet]}>
              Are you sure you want to log out?{"\n"}You'll need to sign in again to access your account.
            </Text>

            <View style={[styles.modalButtons, isTablet && styles.modalButtonsTablet]}>
              <TouchableOpacity
                style={[styles.cancelButton, isTablet && styles.modalBtnTablet]}
                onPress={cancelLogout}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, isTablet && styles.btnTextTablet]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logoutButton, isTablet && styles.modalBtnTablet]}
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={isTablet ? 20 : 16} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={[styles.logoutButtonText, isTablet && styles.btnTextTablet]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.bgCard,
  },
  glowLine: {
    height: 1,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.35,
  },

  // ── Footer bar ────────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    backgroundColor: COLORS.bgCard,
    position: "relative",
    height: 66,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: SPACING.xs,
    position: "relative",
  },
  tabText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: FONT_WEIGHT.medium,
  },
  tabTextTablet: {
    fontSize: FONT_SIZE.sm,
    marginTop: 5,
  },
  tabTextActive: {
    color: COLORS.accentBlue,
  },
  activeDot: {
    position: "absolute",
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentBlue,
  },
  centerSpacer: {
    flex: 1,
  },

  // ── Floating center button ─────────────────────────────────────────────────
  centerButton: {
    position: "absolute",
    backgroundColor: COLORS.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  centerButtonRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(0,209,255,0.30)",
  },

  // ── Modal shared ──────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },

  // ── More menu ─────────────────────────────────────────────────────────────
  moreMenu: {
    position: "absolute",
    bottom: 82,
    right: SPACING.base,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.lg,
    minWidth: 190,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  moreMenuGlow: {
    height: 2,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  menuItemTablet: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    gap: SPACING.base,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxTablet: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.lg,
  },
  menuItemText: {
    flex: 1,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
  },
  menuItemTextTablet: {
    fontSize: FONT_SIZE.md,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginHorizontal: SPACING.base,
  },

  // ── Logout modal ──────────────────────────────────────────────────────────
  logoutModal: {
    backgroundColor: COLORS.bgCard,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  logoutModalGlow: {
    height: 2,
    backgroundColor: COLORS.accentOrange,
    opacity: 0.7,
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  warningIconBox: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  warningIconBoxTablet: {
    width: 72,
    height: 72,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  modalTitleTablet: {
    fontSize: FONT_SIZE["2xl"],
  },
  modalMessage: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  modalMessageTablet: {
    fontSize: FONT_SIZE.md,
    lineHeight: 26,
  },
  modalButtons: {
    flexDirection: "row",
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  modalButtonsTablet: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING["2xl"],
    gap: SPACING.base,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentRed,
    shadowColor: COLORS.accentRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },
  modalBtnTablet: {
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.lg,
  },
  btnTextTablet: {
    fontSize: FONT_SIZE.md,
  },
});
