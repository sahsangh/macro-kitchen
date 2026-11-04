import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Palettes } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme();
  const c = Palettes[scheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.bg, card: c.card, primary: c.accent, text: c.text, border: c.border } }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: c.bg }, headerTintColor: c.accent, headerTitleStyle: { color: c.text }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal', title: 'Add food' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="food/[id]" options={{ title: '' }} />
          <Stack.Screen name="custom-food" options={{ presentation: 'modal', title: 'New food' }} />
          <Stack.Screen name="quick-add" options={{ presentation: 'modal', title: 'Quick add' }} />
          <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
          <Stack.Screen name="recipe/edit" options={{ presentation: 'modal', title: 'Recipe' }} />
          <Stack.Screen name="recipe/cook" options={{ presentation: 'modal', title: 'I made this' }} />
          <Stack.Screen name="batch/[id]" options={{ title: '' }} />
          <Stack.Screen name="goals" options={{ presentation: 'modal', title: 'Goals & settings' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout', gestureEnabled: false }} />
          <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add exercises' }} />
          <Stack.Screen name="routine/edit" options={{ presentation: 'modal', title: 'Routine' }} />
          <Stack.Screen name="cardio" options={{ presentation: 'modal', title: 'Log cardio' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
          <Stack.Screen name="weight" options={{ title: 'Body weight' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
