import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: screenWidth } = Dimensions.get('window');

interface SearchableItem {
  id: string;
  name: string;
  serialNo: string;
  status: string;
  statusColor: string;
  location: string;
  distance: string;
  hasTrailer?: boolean;
  trailerInfo?: string | null;
}

interface CombinedSearchResultsProps<T extends SearchableItem> {
  title: string;
  placeholder: string;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  onItemSelect: (item: T) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  selectedItem: T | null;
  data: T[];
  showSkip?: boolean;
}

// Types
type RootStackParamList = {
  Dashboard: undefined;
  Inspection: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Inspection'>;

interface VehicleItem extends SearchableItem {
  hasTrailer: boolean;
  trailerInfo?: string;
}

interface TrailerItem extends SearchableItem {
  hasTrailer?: boolean; // Make this optional for TrailerItem
}

interface ShipmentItem extends SearchableItem {
  hasTrailer?: boolean; // Make this optional for ShipmentItem
}

interface InspectionItem {
  id: string;
  name: string;
  isChecked: boolean;
}

// Data
const dummyVehicles: VehicleItem[] = [
  {
    id: "1",
    name: "Cascadia",
    serialNo: "1253566",
    status: "On Track with Active Load",
    statusColor: "#F59E0B",
    location: "Downtown Depot",
    distance: "0.5 km",
    hasTrailer: true,
    trailerInfo: "GreatDane - 1265456"
  },
  {
    id: "2",
    name: "Cascadia",
    serialNo: "12jkk555",
    status: "Ready to Load",
    statusColor: "#10B981",
    location: "North Terminal",
    distance: "2.1 km",
    hasTrailer: false,
    trailerInfo: undefined
  },
  {
    id: "3",
    name: "Cascadia",
    serialNo: "141584",
    status: "On In Service",
    statusColor: "#EF4444",
    location: "Service Bay",
    distance: "5.3 km",
    hasTrailer: true,
    trailerInfo: "Utility - 1389454"
  },
];

const dummyTrailers: TrailerItem[] = [
  {
    id: "1",
    name: "GreatDane",
    serialNo: "1265456",
    status: "Available",
    statusColor: "#10B981",
    location: "Downtown Depot",
    distance: "0.5 km"
  },
  {
    id: "2",
    name: "GreatDane",
    serialNo: "1394956",
    status: "In Use",
    statusColor: "#F59E0B",
    location: "Loading Dock A",
    distance: "1.8 km"
  },
  {
    id: "3",
    name: "Utility",
    serialNo: "1389454",
    status: "Maintenance",
    statusColor: "#EF4444",
    location: "Service Center",
    distance: "4.2 km"
  },
];

const dummyShipments: ShipmentItem[] = [
  {
    id: "1",
    name: "Shipment",
    serialNo: "SH001234",
    status: "Ready to Ship",
    statusColor: "#10B981",
    location: "Warehouse A",
    distance: "1.2 km"
  },
  {
    id: "2",
    name: "Shipment",
    serialNo: "SH005678",
    status: "Processing",
    statusColor: "#F59E0B",
    location: "Processing Center",
    distance: "3.5 km"
  },
  {
    id: "3",
    name: "Shipment",
    serialNo: "SH009012",
    status: "On Hold",
    statusColor: "#EF4444",
    location: "Holding Area",
    distance: "6.1 km"
  },
];

const inspectionItems: InspectionItem[] = [
  { id: "1", name: "Brakes (Parking)", isChecked: false },
  { id: "2", name: "Brakes (Service)", isChecked: false },
  { id: "3", name: "Coupling Devices", isChecked: false },
  { id: "4", name: "Emergency Equipment", isChecked: false },
  { id: "5", name: "Horn", isChecked: false },
  { id: "6", name: "Lights and Reflectors", isChecked: false },
  { id: "7", name: "Mirrors", isChecked: false },
  { id: "8", name: "Steering", isChecked: false },
  { id: "9", name: "Tires", isChecked: false },
  { id: "10", name: "Wheels & Rims", isChecked: false },
  { id: "11", name: "Windshield Wipers", isChecked: false },
  { id: "12", name: "Others", isChecked: false },
];

// Progress Indicator Component
const ProgressIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ['Vehicle', 'Trailer', 'Shipment'];

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        {steps.map((stepName, index) => (
          <View key={stepName} style={styles.stepRow}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.stepCircle,
                  index + 1 === currentStep && styles.activeStep,
                  index + 1 < currentStep && styles.completedStep,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    index + 1 === currentStep && styles.activeStepText,
                    index + 1 < currentStep && styles.completedStepText,
                  ]}
                >
                  {index + 1 < currentStep ? '✓' : (index + 1).toString()}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index + 1 === currentStep && styles.activeStepLabel,
                ]}
              >
                {stepName}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  index + 1 < currentStep && styles.completedConnector,
                ]}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

// Back Button Component
const BackButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={styles.backButton} onPress={onPress}>
    <Text style={styles.backButtonText}>← Back</Text>
  </TouchableOpacity>
);

function CombinedSearchResults<T extends SearchableItem>({
  title,
  placeholder,
  searchQuery,
  setSearchQuery,
  onItemSelect,
  onNext,
  onBack,
  onSkip,
  selectedItem,
  data,
  showSkip,
}: CombinedSearchResultsProps<T>) {
  const [filteredResults, setFilteredResults] = useState(data);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      const sorted = [...data].sort(
        (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
      );
      setFilteredResults(sorted);
    } else {
      const filtered = data.filter(
        (item) =>
          item.serialNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredResults(filtered);
    }
  }, [searchQuery, data]);

  return (
    <View style={styles.combinedContainer}>
      {/* Compact Header */}
      <View style={styles.compactHeader}>
        <TouchableOpacity style={styles.compactBackButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.compactTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Compact Search */}
      <View style={styles.compactSearchCard}>
        <TextInput
          style={styles.compactSearchInput}
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
        <Text style={styles.searchIcon}>🔍</Text>
      </View>

      {/* Compact Results List */}
      <View style={styles.compactResultsCard}>
        <Text style={styles.compactResultsTitle}>
          {searchQuery ? `Results (${filteredResults.length})` : `Nearby Items`}
        </Text>

        <ScrollView
          style={styles.compactScrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredResults.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => onItemSelect(item)}
              style={[
                styles.compactResultItem,
                selectedItem?.id === item.id && styles.compactSelectedItem,
              ]}
            >
              <View style={styles.compactItemContent}>
                <View style={styles.compactItemInfo}>
                  <Text style={styles.compactItemTitle}>
                    {item.name} : {item.serialNo}
                  </Text>
                  <View style={styles.compactItemRow}>
                    <Text style={[styles.compactItemStatus, { color: item.statusColor }]}>
                      {item.status}
                    </Text>
                    <Text style={styles.compactDistanceText}>
                      {item.distance}
                    </Text>
                  </View>
                  <Text style={styles.compactLocationText}>
                    📍 {item.location}
                  </Text>
                  {item.hasTrailer && (
                    <Text style={styles.compactTrailerInfo}>
                      🚛 {item.trailerInfo}
                    </Text>
                  )}
                </View>
                {selectedItem?.id === item.id && (
                  <View style={styles.compactCheckIcon}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Compact Action Buttons */}
      {(selectedItem || showSkip) && (
        <View style={styles.compactActionButtons}>
          {showSkip && (
            <TouchableOpacity style={styles.compactSkipButton} onPress={onSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          )}
          {selectedItem && (
            <TouchableOpacity
              style={[
                styles.compactNextButton,
                showSkip && styles.compactNextButtonWithSkip,
              ]}
              onPress={onNext}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// Inspection Screen Component
const InspectionScreen = ({
  selectedVehicle,
  inspectionChecklist,
  inspectionLocation,
  setInspectionLocation,
  remarks,
  setRemarks,
  inspectionType,
  setInspectionType,
  onInspectionItemToggle,
  onSubmit,
  onBack,
  showForm,
  setShowForm
}: {
  selectedVehicle: VehicleItem | null;
  inspectionChecklist: InspectionItem[];
  inspectionLocation: string;
  setInspectionLocation: (location: string) => void;
  remarks: string;
  setRemarks: (remarks: string) => void;
  inspectionType: string;
  setInspectionType: (type: string) => void;
  onInspectionItemToggle: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
}) => {
  if (!selectedVehicle) return null;

  // Check if any checkbox is selected (has defects)
  const hasDefects = inspectionChecklist.some(item => item.isChecked);

  return (
    <View style={styles.inspectionContainer}>
      <BackButton onPress={onBack} />

      <View style={styles.inspectionHeaderCard}>
        <View style={styles.inspectionHeader}>
          <View style={styles.inspectionHeaderInfo}>
            <Text style={styles.inspectionTitle}>Inspect Vehicle</Text>
            <Text style={styles.inspectionSubtitle}>
              {selectedVehicle.name} : S.No : {selectedVehicle.serialNo}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: selectedVehicle.statusColor + '20',
              }
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: selectedVehicle.statusColor }]}>
              {selectedVehicle.status}
            </Text>
          </View>
        </View>

        {!showForm && (
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={styles.greenButton}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

      {showForm && (
        <ScrollView style={styles.resultsCard} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.expandPreviewsButton}>
            <Text style={styles.expandPreviewsText}>Expand Previous Inspection</Text>
          </TouchableOpacity>

          <View style={styles.newInspectionHeader}>
            <Text style={styles.newInspectionText}>New inspection</Text>
          </View>

          <View style={styles.checklistContainer}>
            {inspectionChecklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.inspectionItem}
                onPress={() => onInspectionItemToggle(item.id)}
              >
                <View style={styles.checkboxItemContainer}>
                  <View style={[styles.checkbox, item.isChecked && styles.checkedBox]}>
                    {item.isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.inspectionItemText}>{item.name}</Text>
                </View>
                <View style={styles.dropdownIcon}>
                  <Text style={styles.dropdownArrow}>⌄</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Inspection Location</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter inspection location"
              value={inspectionLocation}
              onChangeText={setInspectionLocation}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter remarks"
              value={remarks}
              onChangeText={setRemarks}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Select Inspection Type</Text>
            <View style={styles.typeButtonsContainer}>
              {['Pre Trip', 'In Trip', 'Post Trip'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setInspectionType(type)}
                  style={[
                    styles.typeButton,
                    inspectionType === type && styles.selectedTypeButton,
                  ]}
                >
                  <Text style={[
                    styles.typeButtonText,
                    inspectionType === type && styles.selectedTypeButtonText,
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.submitContainer}>
            <View style={styles.submitButtonsRow}>
              {/* Show "No Defects" button only if NO checkboxes are selected */}
              {!hasDefects && (
                <TouchableOpacity
                  onPress={onSubmit}
                  style={[
                    styles.noDefectsButton,
                    { opacity: !inspectionType ? 0.5 : 1 }
                  ]}
                  disabled={!inspectionType}
                >
                  <Text style={styles.buttonText}>No Defects</Text>
                </TouchableOpacity>
              )}

              {/* Submit button - always show but adjust width */}
              <TouchableOpacity
                onPress={onSubmit}
                style={[
                  styles.submitButton,
                  { opacity: !inspectionType ? 0.5 : 1 },
                  hasDefects ? styles.submitButtonFullWidth : {}
                ]}
                disabled={!inspectionType}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Success Screen Component
const SuccessScreen = ({
  selectedVehicle,
  onFinish
}: {
  selectedVehicle: VehicleItem | null;
  onFinish: () => void;
}) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.successContainer}>
      <View style={styles.successCard}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successCheckmark}>✓</Text>
          </View>
          <Text style={styles.successTitle}>
            Inspection Saved Successfully
          </Text>
          {selectedVehicle && (
            <Text style={styles.successSubtitle}>
              {selectedVehicle.name} : S.No : {selectedVehicle.serialNo}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            onFinish();
            navigation.navigate('Dashboard');
          }}
          style={styles.nextButton}
        >
          <Text style={styles.buttonText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Component
const NewTripScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Main flow states
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [currentView, setCurrentView] = useState<'search' | 'results' | 'inspection' | 'success'>('search');

  // Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<VehicleItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{
    vehicle: VehicleItem | null;
    trailer: TrailerItem | null;
    shipment: ShipmentItem | null;
  }>({
    vehicle: null,
    trailer: null,
    shipment: null
  });

  // Inspection states
  const [inspectionChecklist, setInspectionChecklist] = useState<InspectionItem[]>([...inspectionItems]);
  const [inspectionLocation, setInspectionLocation] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [inspectionType, setInspectionType] = useState<string>("");
  const [showInspectionForm, setShowInspectionForm] = useState<boolean>(false);

  // Generic handler for item selection
  const handleItemSelect = <T extends SearchableItem>(item: T) => {
    if (currentStep === 1) {
      setSelectedItems(prev => ({ ...prev, vehicle: item as VehicleItem }));
    } else if (currentStep === 2) {
      setSelectedItems(prev => ({ ...prev, trailer: item as TrailerItem }));
    } else if (currentStep === 3) {
      setSelectedItems(prev => ({ ...prev, shipment: item as ShipmentItem }));
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setCurrentView('search');
      setSearchQuery("");
      setSearchResults([]);
    } else {
      setCurrentStep(4);
      setCurrentView('inspection');
    }
  };

  const handleBack = () => {
    if (currentView === 'results') {
      setCurrentView('search');
      setSearchResults([]);
    } else if (currentView === 'inspection') {
      setCurrentStep(3);
      setCurrentView('search');
      setShowInspectionForm(false);
    } else if (currentView === 'search') {
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
        setSearchQuery("");
        setSearchResults([]);
        const currentKey = currentStep === 1 ? 'vehicle' : currentStep === 2 ? 'trailer' : 'shipment';
        setSelectedItems(prev => ({ ...prev, [currentKey]: null }));
      } else {
        navigation.navigate('Dashboard');
      }
    }
  };

  const handleSkipTrailer = () => {
    setCurrentStep(3);
    setSearchQuery("");
  };

  const handleInspectionItemToggle = (id: string) => {
    setInspectionChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isChecked: !item.isChecked } : item
      )
    );
  };

  const handleInspectionSubmit = () => {
    setCurrentStep(5);
    setCurrentView('success');
  };

  const handleFinish = () => {
    setCurrentStep(1);
    setCurrentView('search');
    setSearchQuery("");
    setSearchResults([]);
    setSelectedItems({ vehicle: null, trailer: null, shipment: null });
    setInspectionChecklist([...inspectionItems]);
    setInspectionLocation("");
    setRemarks("");
    setInspectionType("");
    setShowInspectionForm(false);
  };

  const getCurrentSelectedItem = () => {
    return currentStep === 1 ? selectedItems.vehicle :
      currentStep === 2 ? selectedItems.trailer :
        selectedItems.shipment;
  };

  const renderContent = () => {
    // Success Screen
    if (currentView === 'success') {
      return (
        <SuccessScreen
          selectedVehicle={selectedItems.vehicle}
          onFinish={handleFinish}
        />
      );
    }

    // Inspection Screen
    if (currentView === 'inspection') {
      return (
        <InspectionScreen
          selectedVehicle={selectedItems.vehicle}
          inspectionChecklist={inspectionChecklist}
          inspectionLocation={inspectionLocation}
          setInspectionLocation={setInspectionLocation}
          remarks={remarks}
          setRemarks={setRemarks}
          inspectionType={inspectionType}
          setInspectionType={setInspectionType}
          onInspectionItemToggle={handleInspectionItemToggle}
          onSubmit={handleInspectionSubmit}
          onBack={handleBack}
          showForm={showInspectionForm}
          setShowForm={setShowInspectionForm}
        />
      );
    }

    // Search screens
    return (
      <View style={styles.mainContainer}>
        <ProgressIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <CombinedSearchResults<VehicleItem>
            title="Select Vehicle"
            placeholder="Search vehicles..."
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onItemSelect={handleItemSelect}
            onNext={handleNext}
            onBack={handleBack}
            selectedItem={selectedItems.vehicle}
            data={dummyVehicles}
            showSkip={false}
          />
        )}

        {currentStep === 2 && (
          <CombinedSearchResults<TrailerItem>
            title="Select Trailer"
            placeholder="Search trailers..."
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onItemSelect={handleItemSelect}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkipTrailer}
            selectedItem={selectedItems.trailer}
            data={dummyTrailers}
            showSkip={true}
          />
        )}

        {currentStep === 3 && (
          <CombinedSearchResults<ShipmentItem>
            title="Select Shipment"
            placeholder="Search shipments..."
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onItemSelect={handleItemSelect}
            onNext={handleNext}
            onBack={handleBack}
            selectedItem={selectedItems.shipment}
            data={dummyShipments}
            showSkip={false}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {renderContent()}
    </SafeAreaView>
  );
};


// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 20
  },
  scrollViewContainer: {
    flex: 1,
  },
  searchFormContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  inspectionContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  combinedContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerSection: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  findButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  findButtonText: {
    fontSize: 18,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  trailerInfo: {
    fontSize: 12,
    color: '#8B5CF6',
    marginTop: 2,
  },
  actionButtonsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    gap: 12,
  },

  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  compactBackButton: {
    padding: 4,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 50, // Balance the back button width
  },
  compactSearchCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 4,
  },
  searchIcon: {
    marginLeft: 8,
    fontSize: 16,
  },
  compactResultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
  },
  compactResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  compactScrollContainer: {
    flex: 1,
  },
  compactResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  compactSelectedItem: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  compactItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactItemInfo: {
    flex: 1,
  },
  compactItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  compactItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactItemStatus: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  compactDistanceText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  compactLocationText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 1,
  },
  compactTrailerInfo: {
    fontSize: 11,
    color: '#8B5CF6',
  },
  compactCheckIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  compactActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  compactSkipButton: {
    backgroundColor: '#6B7280',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  compactNextButton: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 2,
  },
  compactNextButtonWithSkip: {
    flex: 2,
  },
  skipButton: {
    backgroundColor: '#6B7280',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    flex: 1,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonWithSkip: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressContainer: {
    marginTop: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStep: {
    backgroundColor: '#8B5CF6',
  },
  completedStep: {
    backgroundColor: '#10B981',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeStepText: {
    color: '#FFFFFF',
  },
  completedStepText: {
    color: '#FFFFFF',
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  activeStepLabel: {
    color: '#8B5CF6',
  },
  stepConnector: {
    width: Math.min(30, (screenWidth - 200) / 3),
    height: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  completedConnector: {
    backgroundColor: '#10B981',
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20,
  },
  searchContainer: {
    gap: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    flex: 1,
    maxHeight: '80%',
  },
  resultsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  scrollContainer: {
    flex: 1,
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 80,
    justifyContent: 'center',
  },
  selectedItem: {
    backgroundColor: '#F3F4F6',
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  itemStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  nextButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  nextButton: {
    backgroundColor: '#8B5CF6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  inspectionHeaderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  inspectionHeaderInfo: {
    flex: 1,
    paddingRight: 12,
  },
  inspectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  inspectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  greenButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  expandPreviewsButton: {
    backgroundColor: '#8B5CF6',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPreviewsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  newInspectionHeader: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  newInspectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  checklistContainer: {
    backgroundColor: '#FFFFFF',
  },
  inspectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minHeight: 60,
  },
  checkboxItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkedBox: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inspectionItemText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
    flexWrap: 'wrap',
  },
  dropdownIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownArrow: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minHeight: 40,
    justifyContent: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  selectedTypeButtonText: {
    color: '#FFFFFF',
  },
  submitContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  submitButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  submitButtonFullWidth: {
    flex: 1,
  },
  noDefectsButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    maxHeight: '80%',
  },
  successContent: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#10B981',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successCheckmark: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    flexWrap: 'wrap',
  },
});

export default NewTripScreen;