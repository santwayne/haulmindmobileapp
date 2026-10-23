import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { Svg, Circle, Line, Path } from "react-native-svg";

export default function FuelUpdateScreen() {
  const [showForm, setShowForm] = useState(false);

  return (
    <View style={styles.container}>
      {/* Fuel Gauge */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Fuel Level</Text>
        <View style={styles.gaugeWrapper}>
          <Svg height="140" width="220" viewBox="0 0 220 140">
            {/* Gauge Arc Background */}
            <Path
              d="M 40 110 A 70 70 0 0 1 180 110"
              stroke="#e0e0e0"
              strokeWidth="8"
              fill="none"
            />

            {/* Gauge Arc Segments */}
            <Path
              d="M 40 110 A 70 70 0 0 1 110 40"
              stroke="#333"
              strokeWidth="8"
              fill="none"
            />

            {/* Small tick marks */}
            <Line x1="40" y1="110" x2="45" y2="105" stroke="#333" strokeWidth="2" />
            <Line x1="60" y1="65" x2="65" y2="60" stroke="#333" strokeWidth="2" />
            <Line x1="110" y1="40" x2="110" y2="35" stroke="#333" strokeWidth="2" />
            <Line x1="160" y1="65" x2="155" y2="60" stroke="#333" strokeWidth="2" />
            <Line x1="180" y1="110" x2="175" y2="105" stroke="#333" strokeWidth="2" />

            {/* Needle */}
            <Line
              x1="110"
              y1="110"
              x2="85"
              y2="75"
              stroke="#ff0000"
              strokeWidth="3"
            />

            {/* Center dot */}
            <Circle cx="110" cy="110" r="4" fill="#333" />

            {/* Fuel icon (simplified gas pump) */}
            <Svg x="100" y="50" width="20" height="20">
              <Path
                d="M 2 18 L 2 6 L 12 6 L 12 8 L 16 4 L 18 6 L 18 18 L 16 18 L 16 10 L 14 10 L 14 18 L 2 18 Z M 4 8 L 4 16 L 10 16 L 10 8 L 4 8 Z"
                fill="#ff0000"
              />
            </Svg>
          </Svg>

          <View style={styles.gaugeLabels}>
            <Text style={styles.eLabel}>E</Text>
            <Text style={styles.fLabel}>F</Text>
          </View>
        </View>
      </View>

      {/* Fuel Info */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Update About Fuel</Text>
          <Text style={styles.value}>60 LTR</Text>
        </View>
        <Text style={styles.subText}>105 MB Winnipeg</Text>
      </View>

      {/* Expandable Fuel Update Form */}
      <TouchableOpacity
        style={styles.updateLinkContainer}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.updateLink}>
          +Fuel Update <Text style={styles.updateHint}>(Open after Click)</Text>
        </Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Fuel Quantity in LTR</Text>
            <TextInput
              placeholder="LTR"
              style={styles.input}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>City/Town</Text>
            <TextInput
              placeholder="City/Town"
              style={styles.input}
            />
          </View>

          <TouchableOpacity style={styles.submitButton}>
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    color: "#333",
  },
  gaugeWrapper: {
    alignItems: "center",
    position: "relative",
  },
  gaugeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 140,
    position: "absolute",
    bottom: 10,
    paddingHorizontal: 10,
  },
  eLabel: {
    color: "#ff0000",
    fontWeight: "700",
    fontSize: 16,
  },
  fLabel: {
    color: "#4CAF50",
    fontWeight: "700",
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  updateLinkContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  updateLink: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 16,
  },
  updateHint: {
    color: "#666",
    fontWeight: "400",
    fontSize: 14,
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  submitButton: {
    backgroundColor: "#9C27B0",
    padding: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});