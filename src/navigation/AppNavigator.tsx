import React, { useState } from 'react';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';

type Screen = 'splash' | 'login' | 'home';

export function AppNavigator() {
  const [screen, setScreen] = useState<Screen>('splash');

  if (screen === 'splash') {
    return <SplashScreen onFinish={() => setScreen('login')} />;
  }
  if (screen === 'login') {
    return <LoginScreen onLogin={() => setScreen('home')} />;
  }
  return <HomeScreen />;
}
