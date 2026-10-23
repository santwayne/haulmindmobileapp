import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Logger from '../utils/Logger';
import { crashReporter } from '../utils/crashReporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // CRITICAL: Log synchronously first (survives app termination)
    console.error('💥💥💥 ERROR BOUNDARY CAUGHT ERROR 💥💥💥');
    console.error('Error:', error.name, '-', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('💥💥💥 ERROR BOUNDARY END 💥💥💥');

    // Log to crash reporter (synchronous first, then async)
    crashReporter.logCrashSync(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      errorInfo: errorInfo.toString()
    });

    // Also log via Logger
    Logger.error('React Error Boundary caught an error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
    }, 'ErrorBoundary');

    // Update state with error info
    this.state = {
      ...this.state,
      error,
      errorInfo,
    };
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.errorContainer}>
            <Text style={styles.title}>⚠️ Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            
            {__DEV__ && this.state.error && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Error Details:</Text>
                <Text style={styles.detailsText}>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <ScrollView style={styles.stackContainer}>
                    <Text style={styles.stackText}>{this.state.error.stack}</Text>
                  </ScrollView>
                )}
                {this.state.errorInfo?.componentStack && (
                  <>
                    <Text style={styles.detailsTitle}>Component Stack:</Text>
                    <ScrollView style={styles.stackContainer}>
                      <Text style={styles.stackText}>{this.state.errorInfo.componentStack}</Text>
                    </ScrollView>
                  </>
                )}
              </View>
            )}
            
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailsContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  detailsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  stackContainer: {
    maxHeight: 200,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  stackText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;

