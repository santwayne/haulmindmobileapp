import React from "react";
import { View, Image, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../../theme";

const logo = require("../../../assets/FleetGo.png");

export default function Header() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <Image
          source={logo}
          style={[styles.logo, isTablet && styles.logoTablet]}
          resizeMode="contain"
        />
      </View>
      {/* Neon glow line — mirrors the web's --accent-blue border */}
      <View style={styles.glowLine} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.bgCard,
  },
  header: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.base,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgCard,
  },
  headerTablet: {
    paddingVertical: SPACING.md + 4,
  },
  logo: {
    width: 110,
    height: 36,
  },
  logoTablet: {
    width: 158,
    height: 52,
  },
  glowLine: {
    height: 1,
    backgroundColor: COLORS.accentBlue,
    opacity: 0.45,
  },
});
