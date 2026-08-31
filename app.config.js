const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

module.exports = {
  expo: {
    name: IS_PREVIEW ? 'theM Preview' : 'theM',
    slug: 'avi',
    scheme: 'them',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#050510',
    plugins: [
      'expo-dev-client',
      ['expo-audio', { microphonePermission: 'The-M needs your microphone to hear you speak.' }],
      'expo-secure-store',
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'The-M needs your microphone to hear your voice.',
          speechRecognitionPermission: 'The-M uses on-device speech recognition to transcribe what you say.',
          androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
        },
      ],
    ],
    developmentClient: { silentLaunch: true },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_PREVIEW ? 'com.avicoiot.them.preview' : 'com.avicoiot.them',
      buildNumber: '2',
    },
    android: {
      newArchEnabled: true,
      package: IS_PREVIEW ? 'com.avicoiot.them.preview' : 'com.avicoiot.them',
      versionCode: 2,
      adaptiveIcon: {
        backgroundColor: '#050510',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    extra: { eas: { projectId: '4e5ba723-3e78-4260-a424-83dfb515c0f1' } },
    owner: 'aviciots-team',
  },
};
