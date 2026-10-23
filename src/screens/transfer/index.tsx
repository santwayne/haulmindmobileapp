import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  FlatList,
  Alert 
} from "react-native";

interface Driver {
  id: string;
  name: string;
  codeId: string;
  type: 'Driver' | 'Officer';
  status: 'available' | 'busy' | 'offline';
}

const TransferScreen = () => {
  const [comment, setComment] = useState("");
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Static driver data
  const availableDrivers: Driver[] = [
    { id: '1', name: 'Driver Smith', codeId: '516625', type: 'Driver', status: 'available' },
    { id: '2', name: 'Officer Johnson', codeId: '418392', type: 'Officer', status: 'available' },
    { id: '3', name: 'Driver Wilson', codeId: '725149', type: 'Driver', status: 'available' },
    { id: '4', name: 'Driver Brown', codeId: '934827', type: 'Driver', status: 'busy' },
    { id: '5', name: 'Officer Davis', codeId: '162738', type: 'Officer', status: 'available' },
    { id: '6', name: 'Driver Garcia', codeId: '583947', type: 'Driver', status: 'offline' },
  ];

  const handleDriverSelect = (driver: Driver) => {
    if (driver.status !== 'available') {
      Alert.alert(
        "Driver Unavailable", 
        `${driver.name} is currently ${driver.status}. Please select an available driver.`
      );
      return;
    }
    setSelectedDriver(driver);
    setShowDriverModal(false);
  };

  const handleTransfer = () => {
    if (!selectedDriver) {
      Alert.alert("Error", "Please select a driver to transfer to.");
      return;
    }

    Alert.alert(
      "Confirm Transfer",
      `Transfer vehicle Cascadio (S.No: 1253566) from Morgan to ${selectedDriver.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Transfer", 
          style: "default",
          onPress: () => {
            Alert.alert(
              "Transfer Successful", 
              `Vehicle has been transferred to ${selectedDriver.name}\n\nTransfer ID: TRF${Date.now().toString().slice(-6)}`
            );
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'available': return '#4CAF50';
      case 'busy': return '#FF9800';
      case 'offline': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const renderDriverModal = () => (
    <Modal
      visible={showDriverModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Driver/Officer</Text>
            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setShowDriverModal(false)}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={availableDrivers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.driverItem,
                  item.status !== 'available' && styles.unavailableDriver
                ]}
                onPress={() => handleDriverSelect(item)}
              >
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{item.name}</Text>
                  <Text style={styles.driverDetails}>
                    Code ID: {item.codeId} • {item.type}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) }
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Transfer Vehicle</Text>
      <Text style={styles.subTitle}>
        Cascadio : <Text style={styles.boldText}>S.No : 1253566</Text>
      </Text>

      {/* Current Driver Row */}
      <View style={styles.grayRow}>
        <Text style={styles.rowLabel}>Driver Name</Text>
        <Text style={styles.rowValue}>Morgan</Text>
      </View>

      {/* Transfer To Row */}
      <View style={styles.transferRow}>
        <Text style={styles.transferLabel}>Transfer to</Text>
        <TouchableOpacity 
          style={styles.transferButton}
          onPress={() => setShowDriverModal(true)}
        >
          <Text style={styles.transferIcon}>✎</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Driver Info */}
      <View style={styles.whiteRow}>
        <Text style={styles.rowLabel}>Driver or officer</Text>
        <Text style={styles.rowValue}>
          {selectedDriver ? selectedDriver.name : 'Not Selected'}
        </Text>
      </View>

      <View style={styles.whiteRow}>
        <Text style={styles.rowLabel}>Code ID</Text>
        <Text style={styles.rowValue}>
          {selectedDriver ? selectedDriver.codeId : '--'}
        </Text>
      </View>

      {/* Comment Section */}
      <Text style={styles.commentLabel}>Add Comment</Text>
      <TextInput
        style={styles.commentBox}
        multiline
        numberOfLines={4}
        value={comment}
        onChangeText={setComment}
        placeholder="Write your comment..."
        placeholderTextColor="#999"
        textAlignVertical="top"
      />

      {/* Transfer Button */}
      <TouchableOpacity 
        style={[
          styles.transferBtn,
          !selectedDriver && styles.disabledBtn
        ]} 
        onPress={handleTransfer}
        disabled={!selectedDriver}
      >
        <Text style={styles.transferBtnText}>Transfer</Text>
      </TouchableOpacity>

      {/* Driver Selection Modal */}
      {renderDriverModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  subTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  boldText: {
    fontWeight: "700",
    color: "#333",
  },
  grayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E6E6E6",
    padding: 16,
    marginBottom: 12,
    borderRadius: 6,
  },
  whiteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    marginBottom: 12,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    marginBottom: 12,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rowLabel: {
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  transferLabel: {
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
  },
  transferButton: {
    padding: 4,
  },
  transferIcon: {
    fontSize: 18,
    color: "#2196F3",
  },
  commentLabel: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    marginTop: 8,
    fontWeight: "500",
  },
  commentBox: {
    height: 100,
    backgroundColor: "#E6E6E6",
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginBottom: 24,
  },
  transferBtn: {
    backgroundColor: "#906AD1",
    padding: 16,
    borderRadius: 6,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledBtn: {
    backgroundColor: "#ccc",
    elevation: 0,
    shadowOpacity: 0,
  },
  transferBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    width: '90%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#666',
  },
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unavailableDriver: {
    opacity: 0.6,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  driverDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default TransferScreen;