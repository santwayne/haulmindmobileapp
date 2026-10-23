import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Linking,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Conditionally import DocumentPicker (not available in Expo Go, requires custom build)
let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.warn('expo-document-picker not available, document upload will be disabled');
}
import { apiService } from '../../services/api/apiService';
import { logger } from '../../utils/loggerHelper';

interface Vehicle {
  _id: string;
  internalId?: string;
  plateNumber: string;
  make?: string;
  model?: string;
}

interface Document {
  _id: string;
  documentType: string;
  documentNumber?: string;
  expiryDate?: string;
  issueDate?: string;
  status: 'valid' | 'expired' | 'expiring-soon' | 'pending' | 'rejected';
  fileUrl?: string;
  fileName?: string;
  description?: string;
}

type TabKey = 'driver';

const DocumentsScreen = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const activeTab: TabKey = 'driver';

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    documentType: 'Driving Licence',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      logger.info('Fetching driver documents');
      
      const response = await apiService.getDriverDocuments();

      if (response.success && response.data?.data) {
        setDocuments(response.data.data);
        logger.info('Documents fetched successfully', { count: response.data.data.length });
      } else {
        logger.error('Failed to fetch documents', { error: response.error });
        setDocuments([]);
      }
    } catch (error: any) {
      logger.error('Error fetching documents', error);
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const handleSelectFile = async () => {
    // Check if DocumentPicker is available (requires custom build, not available in Expo Go)
    if (!DocumentPicker || !DocumentPicker.getDocumentAsync) {
      Alert.alert(
        'Feature Not Available',
        'Document picker requires a custom development build. Please build the app using "npx expo run:android" or "npx expo run:ios" for full functionality.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || 'document.pdf',
          type: asset.mimeType || 'application/pdf',
          size: asset.size,
        });
        logger.info('File selected', { name: asset.name, size: asset.size });
      }
    } catch (error: any) {
      logger.error('Error selecting file', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadForm.documentType) {
      Alert.alert('Error', 'Please select a document type');
      return;
    }

    // For new uploads, file is required. For edits, file is optional.
    if (!editingDocument && !selectedFile) {
      Alert.alert('Error', 'Please select a document file');
      return;
    }

    try {
      setUploading(true);
      logger.info(editingDocument ? 'Updating document' : 'Uploading document', { 
        documentType: uploadForm.documentType,
        documentId: editingDocument?._id,
        hasFile: !!selectedFile 
      });

      let response;
      
      if (editingDocument) {
        // Update existing document
        console.log('Calling updateDriverDocument API', {
          documentId: editingDocument._id,
          hasFile: !!selectedFile,
          documentType: uploadForm.documentType
        });
        
        response = await apiService.updateDriverDocument(
          editingDocument._id,
          selectedFile || undefined, // Only send file if a new one is selected
          uploadForm.documentType,
          uploadForm.documentNumber || undefined,
          uploadForm.issueDate || undefined,
          uploadForm.expiryDate || undefined,
          uploadForm.description || undefined
        );
        
        console.log('Update API response:', response);
      } else {
        // Upload new document
        console.log('Calling uploadDriverDocument API', {
          documentType: uploadForm.documentType,
          hasFile: !!selectedFile
        });
        
        response = await apiService.uploadDriverDocument(
          selectedFile!,
          uploadForm.documentType,
          uploadForm.documentNumber || undefined,
          uploadForm.issueDate || undefined,
          uploadForm.expiryDate || undefined,
          uploadForm.description || undefined
        );
        
        console.log('Upload API response:', response);
      }

      if (response.success) {
        // Stop uploading state
        setUploading(false);
        
        // Close modal and reset form immediately
        setShowUploadModal(false);
        resetUploadForm();
        
        // Fetch updated documents
        fetchDocuments();
        
        // Show success alert after interactions complete (ensuring modal has closed)
        InteractionManager.runAfterInteractions(() => {
          Alert.alert('Success', editingDocument ? 'Document updated successfully' : 'Document uploaded successfully');
        });
        
        logger.userAction(editingDocument ? 'Document Updated' : 'Document Uploaded', { documentType: uploadForm.documentType }, 'DocumentsScreen');
      } else {
        // Extract error message from response
        const errorMessage = response.error || response.data?.message || 'Failed to upload document';
        setUploading(false);
        Alert.alert('Upload Failed', errorMessage, [{ text: 'OK' }]);
      }
    } catch (error: any) {
      logger.error('Error uploading document', error);
      setUploading(false);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteDriverDocument(documentId);
              if (response.success) {
                Alert.alert('Success', 'Document deleted successfully');
                fetchDocuments();
                logger.userAction('Document Deleted', { documentId }, 'DocumentsScreen');
              } else {
                Alert.alert('Error', response.error || 'Failed to delete document');
              }
            } catch (error: any) {
              logger.error('Error deleting document', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleViewDocument = async (document: Document) => {
    if (document.fileUrl) {
      try {
        const canOpen = await Linking.canOpenURL(document.fileUrl);
        if (canOpen) {
          await Linking.openURL(document.fileUrl);
        } else {
          Alert.alert('Error', 'Cannot open this document. The file may not be available.');
        }
      } catch (error: any) {
        logger.error('Error opening document', error);
        Alert.alert('Error', 'Failed to open document. Please try again.');
      }
    } else {
      setSelectedDocument(document);
      setShowDocumentModal(true);
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      documentType: 'Driving Licence',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      description: '',
    });
    setSelectedFile(null);
    setEditingDocument(null);
  };

  const handleEditDocument = (document: Document) => {
    console.log('Edit button pressed for document:', document._id, document.documentType);
    try {
      setEditingDocument(document);
      setUploadForm({
        documentType: document.documentType,
        documentNumber: document.documentNumber || '',
        issueDate: document.issueDate ? new Date(document.issueDate).toISOString().split('T')[0] : '',
        expiryDate: document.expiryDate ? new Date(document.expiryDate).toISOString().split('T')[0] : '',
        description: document.description || '',
      });
      setSelectedFile(null); // Don't pre-select file for edit
      setShowUploadModal(true);
      console.log('Edit modal should be opening, showUploadModal set to true');
    } catch (error) {
      console.error('Error in handleEditDocument:', error);
      Alert.alert('Error', 'Failed to open edit form. Please try again.');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'valid':
        return '#4CAF50';
      case 'expired':
        return '#F44336';
      case 'expiring-soon':
      case 'expiring_soon':
        return '#FF9800';
      case 'pending':
        return '#2196F3';
      case 'rejected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'valid':
        return 'Valid';
      case 'expired':
        return 'Expired';
      case 'expiring-soon':
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      default:
        return status || 'Unknown';
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const documentTypes = [
    'Driving Licence',
    'Employment Contract',
    'ID Document',
    'Passport',
    'Work Permit',
    'Background Check',
    'Drug Test',
    'Training Certificate',
    'Insurance Policy',
    'Company Policy',
    'Performance Review',
    'Payroll Document',
    'Tax Document',
    'Emergency Contact',
    'Medical Certificate',
    'Travel Document',
    'Other',
  ];

  const renderDocumentItem = (document: Document) => {
    console.log('Rendering document item:', document._id, document.documentType);
    return (
    <View key={document._id} style={styles.documentItem}>
      <View style={styles.documentHeader}>
        <View style={styles.documentTitleContainer}>
          <Text style={styles.documentName}>{document.documentType}</Text>
          {document.documentNumber && (
            <Text style={styles.documentNumberText}>#{document.documentNumber}</Text>
          )}
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(document.status) }]}>
          <Text style={styles.statusText}>{getStatusText(document.status)}</Text>
        </View>
      </View>

      <View style={styles.documentDetails}>
        {document.issueDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Issued:</Text>
            <Text style={styles.detailValue}>{formatDate(document.issueDate)}</Text>
          </View>
        )}
        {document.expiryDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires:</Text>
            <Text style={[styles.detailValue, document.status === 'expired' || document.status === 'expiring-soon' ? styles.expiringText : null]}>
              {formatDate(document.expiryDate)}
          </Text>
          </View>
        )}
        {document.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>{document.description}</Text>
          </View>
        )}
      </View>

      <View style={styles.documentActions}>
        {document.fileUrl && (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleViewDocument(document)}
          >
            <Ionicons name="eye" size={16} color="#2196F3" />
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            console.log('Edit button onPress triggered');
            handleEditDocument(document);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="create" size={16} color="#FF9800" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteDocument(document._id)}
        >
          <Ionicons name="trash" size={16} color="#F44336" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  const renderUploadModal = () => {
    console.log('Rendering upload modal, visible:', showUploadModal, 'uploading:', uploading);
    return (
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!uploading) {
            setShowUploadModal(false);
            resetUploadForm();
          }
        }}
      >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingDocument ? 'Edit Document' : 'Upload Document'}</Text>
            {!uploading && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <Text style={styles.label}>Document Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeChips}>
                  {documentTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        uploadForm.documentType === type && styles.typeChipActive,
                      ]}
                      onPress={() => setUploadForm({ ...uploadForm, documentType: type })}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          uploadForm.documentType === type && styles.typeChipTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Document Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter document number"
                value={uploadForm.documentNumber}
                onChangeText={(text) => setUploadForm({ ...uploadForm, documentNumber: text })}
                editable={!uploading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Issue Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={uploadForm.issueDate}
                onChangeText={(text) => setUploadForm({ ...uploadForm, issueDate: text })}
                editable={!uploading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Expiry Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={uploadForm.expiryDate}
                onChangeText={(text) => setUploadForm({ ...uploadForm, expiryDate: text })}
                editable={!uploading}
              />
      </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter description (optional)"
                value={uploadForm.description}
                onChangeText={(text) => setUploadForm({ ...uploadForm, description: text })}
                multiline
                numberOfLines={3}
                editable={!uploading}
              />
      </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Document File {editingDocument ? '(Optional)' : '*'}</Text>
              <TouchableOpacity
                style={styles.fileSelector}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <Ionicons name="document-attach" size={24} color="#2196F3" />
                <Text style={styles.fileSelectorText}>
                  {selectedFile 
                    ? selectedFile.name 
                    : editingDocument && editingDocument.fileName
                    ? `Current: ${editingDocument.fileName} (Tap to change)`
                    : 'Select Document (PDF/Image)'}
                </Text>
              </TouchableOpacity>
              {selectedFile && (
                <Text style={styles.fileInfo}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Text>
              )}
              {editingDocument && !selectedFile && editingDocument.fileUrl && (
                <Text style={styles.fileInfo}>
                  Current file: {editingDocument.fileName || 'Existing document'}
                </Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  if (!uploading) {
                    setShowUploadModal(false);
                    resetUploadForm();
                  }
                }}
                disabled={uploading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.submitBtn, uploading && styles.disabledBtn]}
                onPress={handleUploadDocument}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingDocument ? 'Update' : 'Upload'}</Text>
                )}
              </TouchableOpacity>
          </View>
        </ScrollView>
        </View>
      </View>
    </Modal>
    );
  };

  if (loading && documents.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#8B5CF6']}
              tintColor="#8B5CF6"
            />
          }
          nestedScrollEnabled={true}
        >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Documents</Text>
            <Text style={styles.headerSubtitle}>Manage your driver documents</Text>
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => {
              console.log('Upload button pressed');
              setShowUploadModal(true);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Documents List */}
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No Documents Found</Text>
            <Text style={styles.emptyStateSubtext}>
              Upload your first document to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                console.log('Empty state upload button pressed');
                setShowUploadModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyStateButtonText}>Upload Document</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.documentsContainer}>
            {documents.map(renderDocumentItem)}
          </View>
        )}
        </ScrollView>
      </View>

      {renderUploadModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  uploadButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  documentsContainer: {
    padding: 16,
  },
  documentItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'visible', // Ensure buttons are clickable
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentNumberText: {
    fontSize: 12,
    color: '#666',
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  documentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  expiringText: {
    color: '#FF9800',
    fontWeight: '600',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    gap: 6,
  },
  viewButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    gap: 6,
    minHeight: 36,
    minWidth: 80,
    justifyContent: 'center',
    zIndex: 1,
  },
  editButtonText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    gap: 6,
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  modalScrollView: {
    padding: 20,
  },
  modalScrollContent: {
    paddingBottom: 60,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  typeChipActive: {
    backgroundColor: '#8B5CF6',
  },
  typeChipText: {
    fontSize: 12,
    color: '#666',
  },
  typeChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  fileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    gap: 12,
    backgroundColor: '#f9f9f9',
  },
  fileSelectorText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  fileInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  submitBtn: {
    backgroundColor: '#8B5CF6',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DocumentsScreen;
