import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AudioReactivityProvider } from './src/providers/AudioReactivityProvider';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AudioReactivityProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </AudioReactivityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
