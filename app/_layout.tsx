import '../global.css';

import { Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    // Inter font weights
    'Inter-Thin': require('@expo-google-fonts/inter/100Thin/Inter_100Thin.ttf'),
    'Inter-ExtraLight': require('@expo-google-fonts/inter/200ExtraLight/Inter_200ExtraLight.ttf'),
    'Inter-Light': require('@expo-google-fonts/inter/300Light/Inter_300Light.ttf'),
    'Inter-Regular': require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    'Inter-Medium': require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    'Inter-SemiBold': require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
    'Inter-Bold': require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
    'Inter-ExtraBold': require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
    'Inter-Black': require('@expo-google-fonts/inter/900Black/Inter_900Black.ttf'),

    // Bricolage Grotesque font weights
    'BricolageGrotesque-Regular': require('@expo-google-fonts/bricolage-grotesque/400Regular/BricolageGrotesque_400Regular.ttf'),
    'BricolageGrotesque-Medium': require('@expo-google-fonts/bricolage-grotesque/500Medium/BricolageGrotesque_500Medium.ttf'),
    'BricolageGrotesque-SemiBold': require('@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf'),
    'BricolageGrotesque-Bold': require('@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'),
    'BricolageGrotesque-ExtraBold': require('@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView} className="font-sans">
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
