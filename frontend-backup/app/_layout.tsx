import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RegistrationProvider } from '../contexts/RegistrationContext';
import * as SplashScreen from 'expo-splash-screen';

// スプラッシュ画面を手動で制御
SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoading) {
      // 未ログイン時は必ずonboarding（新UI）に飛ばす
      if (!user && segments[0] !== 'start') {
        router.replace('/start/onboarding');
      }
      // ログイン済みでstart配下にいる場合はtabsに飛ばす
      if (user && segments[0] === 'start') {
        router.replace('/(tabs)');
      }
    }
  }, [user, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    // スプラッシュ画面を2秒間表示
    const hideSplash = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      await SplashScreen.hideAsync();
    };
    
    hideSplash();
  }, []);

  return (
    <AuthProvider>
      <RegistrationProvider>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="start" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </AuthGuard>
      </RegistrationProvider>
    </AuthProvider>
  );
}