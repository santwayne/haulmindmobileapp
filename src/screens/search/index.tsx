// src/screens/search/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Keyboard,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '../../theme';

// Type definitions
interface SearchablePage {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
  category: string;
  keywords: string[];
}

interface QuickAction {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
  color: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const searchablePages: SearchablePage[] = [
  {
    id: '1',
    name: 'Active Loads',
    description: 'View and manage currently active loads',
    icon: 'play-circle-outline',
    route: 'ActiveTrips',
    category: 'Load Management',
    keywords: ['active', 'current', 'ongoing', 'loads', 'trips']
  },
  {
    id: '2',
    name: 'Completed Loads',
    description: 'View completed load history',
    icon: 'checkmark-circle-outline',
    route: 'CompleteTrips',
    category: 'Load Management',
    keywords: ['completed', 'finished', 'history', 'past', 'loads', 'trips']
  },
  {
    id: '3',
    name: 'Pending Loads',
    description: 'View scheduled and pending loads',
    icon: 'time-outline',
    route: 'PendingTrips',
    category: 'Load Management',
    keywords: ['pending', 'scheduled', 'upcoming', 'waiting', 'loads', 'trips']
  },
  {
    id: '4',
    name: 'Settings',
    description: 'App settings and preferences',
    icon: 'settings-outline',
    route: 'Settings',
    category: 'Account',
    keywords: ['settings', 'preferences', 'account', 'profile']
  },
  {
    id: '5',
    name: 'Load Map',
    description: 'View routes and navigation maps',
    icon: 'map-outline',
    route: 'LoadMap',
    category: 'Navigation',
    keywords: ['map', 'route', 'navigation', 'gps', 'directions']
  }
];

const recentSearches: string[] = [
  'Active loads',
  'Load map',
  'Completed loads'
];

const quickActions: QuickAction[] = [
  {
    id: 'qa1',
    name: 'Active Loads',
    icon: 'play-circle',
    route: 'ActiveTrips',
    color: COLORS.accentNavyBlue
  },
  {
    id: 'qa2',
    name: 'View Map',
    icon: 'map',
    route: 'LoadMap',
    color: COLORS.accentNavyBlue
  },
  {
    id: 'qa3',
    name: 'Settings',
    icon: 'settings',
    route: 'Settings',
    color: COLORS.accentNavyBlue
  }
];

export default function SearchScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredPages, setFilteredPages] = useState<SearchablePage[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [showRecent, setShowRecent] = useState<boolean>(true);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPages([]);
      setShowRecent(true);
      setSearchPerformed(false);
    } else {
      performSearch(searchQuery);
    }
  }, [searchQuery]);

  const performSearch = (query: string) => {
    const searchTerm = query.toLowerCase().trim();

    // Enhanced search algorithm
    const filtered = searchablePages.filter(page => {
      // Exact name match gets highest priority
      if (page.name.toLowerCase() === searchTerm) return true;

      // Name contains search term
      if (page.name.toLowerCase().includes(searchTerm)) return true;

      // Description contains search term
      if (page.description.toLowerCase().includes(searchTerm)) return true;

      // Category contains search term
      if (page.category.toLowerCase().includes(searchTerm)) return true;

      // Keywords contain search term
      if (page.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))) return true;

      // Check for partial word matches
      const words = searchTerm.split(' ');
      return words.every(word =>
        page.name.toLowerCase().includes(word) ||
        page.description.toLowerCase().includes(word) ||
        page.keywords.some(keyword => keyword.toLowerCase().includes(word))
      );
    });

    // Sort results by relevance
    const sortedResults = filtered.sort((a, b) => {
      // Exact name match first
      if (a.name.toLowerCase() === searchTerm) return -1;
      if (b.name.toLowerCase() === searchTerm) return 1;

      // Name starts with search term
      if (a.name.toLowerCase().startsWith(searchTerm)) return -1;
      if (b.name.toLowerCase().startsWith(searchTerm)) return 1;

      // Name contains search term (closer to beginning is better)
      const aIndex = a.name.toLowerCase().indexOf(searchTerm);
      const bIndex = b.name.toLowerCase().indexOf(searchTerm);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      return a.name.localeCompare(b.name);
    });

    setFilteredPages(sortedResults);
    setShowRecent(false);
    setSearchPerformed(true);
  };

  const handlePagePress = (page: SearchablePage) => {
    Keyboard.dismiss();

    // Add to recent searches if not already there
    if (!recentSearches.includes(page.name)) {
      recentSearches.unshift(page.name);
      if (recentSearches.length > 5) {
        recentSearches.pop();
      }
    }

    navigation.navigate(page.route as any);
  };

  // Updated category list in the "All Pages" section
  {
    showRecent && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Pages</Text>
        {/* Group by category */}
        {['Load Management', 'Navigation', 'Account'].map(category => {
          const categoryPages = searchablePages.filter(page => page.category === category);
          if (categoryPages.length === 0) return null;

          return (
            <View key={category} style={styles.categoryContainer}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categoryPages.map(page => (
                <TouchableOpacity
                  key={page.id}
                  style={styles.pageItem}
                  onPress={() => handlePagePress(page)}
                >
                  <View style={styles.pageIconContainer}>
                    <Ionicons name={page.icon} size={20} color={COLORS.accentNavyBlue} />
                  </View>
                  <View style={styles.pageContent}>
                    <Text style={styles.pageTitle}>{page.name}</Text>
                    <Text style={styles.pageDescription}>{page.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </View>
    )
  }

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowRecent(true);
    setSearchPerformed(false);
  };

  const clearRecentSearches = () => {
    recentSearches.splice(0, recentSearches.length);
  };

  const renderSearchResult = ({ item }: { item: SearchablePage }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handlePagePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIconContainer}>
        <Ionicons name={item.icon} size={24} color={COLORS.accentNavyBlue} />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultDescription}>{item.description}</Text>
        <Text style={styles.resultCategory}>{item.category}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => handleRecentSearch(item)}
    >
      <Ionicons name="time-outline" size={16} color="#9CA3AF" />
      <Text style={styles.recentText}>{item}</Text>
      <Ionicons name="arrow-up-outline" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderQuickAction = ({ item }: { item: QuickAction }) => (
    <TouchableOpacity
      style={[styles.quickActionItem, { backgroundColor: item.color + '20' }]}
      onPress={() => {
        const page = searchablePages.find(p => p.route === item.route);
        if (page) {
          handlePagePress(page);
        }
      }}
    >
      <Ionicons name={item.icon} size={24} color={item.color} />
      <Text style={[styles.quickActionText, { color: item.color }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >

          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused
          ]}>
            <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pages, features, or help topics..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Search Results */}
          {searchPerformed && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Search Results {filteredPages.length > 0 && `(${filteredPages.length})`}
              </Text>
              {filteredPages.length > 0 ? (
                <FlatList
                  data={filteredPages}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.noResultsTitle}>No Pages Found</Text>
                  <Text style={styles.noResultsText}>
                    No pages match "{searchQuery}". Try different keywords or check spelling.
                  </Text>
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={clearSearch}
                  >
                    <Text style={styles.showAllButtonText}>Show All Pages</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Quick Actions */}
          {showRecent && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <FlatList
                data={quickActions}
                renderItem={renderQuickAction}
                keyExtractor={(item) => item.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.quickActionRow}
              />
            </View>
          )}

          {/* Recent Searches */}
          {showRecent && recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearButton}>Clear</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={recentSearches}
                renderItem={renderRecentSearch}
                keyExtractor={(item, index) => index.toString()}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* All Pages (when no search) */}
          {showRecent && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Pages</Text>
              {/* Group by category */}
              {['Load Management', 'Navigation', 'Account'].map(category => {
                const categoryPages = searchablePages.filter(page => page.category === category);
                if (categoryPages.length === 0) return null;

                return (
                  <View key={category} style={styles.categoryContainer}>
                    <Text style={styles.categoryTitle}>{category}</Text>
                    {categoryPages.map(page => (
                      <TouchableOpacity
                        key={page.id}
                        style={styles.pageItem}
                        onPress={() => handlePagePress(page)}
                      >
                        <View style={styles.pageIconContainer}>
                          <Ionicons name={page.icon} size={20} color={COLORS.accentNavyBlue} />
                        </View>
                        <View style={styles.pageContent}>
                          <Text style={styles.pageTitle}>{page.name}</Text>
                          <Text style={styles.pageDescription}>{page.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,

  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchBarFocused: {
    backgroundColor: COLORS.bgCardLight,
    borderColor: COLORS.accentNavyBlue,
    shadowColor: COLORS.accentNavyBlue,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,

  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 8,
    marginRight: 8,

  },
  content: {
    flex: 1,

  },
  section: {
    backgroundColor: COLORS.bgCardLight,
    margin: 16,
    borderRadius: 12,
    padding: 16,


  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,

  },
  clearButton: {
    fontSize: 14,
    color: COLORS.accentNavyBlue,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionRow: {
    justifyContent: 'space-between',
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // Recent Searches
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  recentText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginLeft: 8,
  },

  // Search Results
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  resultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCardLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  resultDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: 11,
    color: COLORS.accentNavyBlue,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // Category Pages
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  pageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentNavyBlue,
  },
  pageIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bgCardLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pageContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  pageDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // No Results
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,

  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  showAllButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.accentNavyBlue,
    borderRadius: 8,
  },
  showAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});