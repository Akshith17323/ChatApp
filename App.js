import React, { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { SocketProvider } from './src/context/SocketContext';
import { MessageOutboxProvider } from './src/context/MessageOutboxContext';
import { NotificationProvider, useNotification } from './src/context/NotificationContext';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import { navigationRef, navigateToChatRoom } from './src/navigation/navigationRef';
import TabNavigator from './src/navigation/Tabnavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { colors, isDark, reduceMotion } = useAppTheme();
  const { user, baseUrl } = useAuth();
  const { inAppNotification, dismissInAppNotification } = useNotification();

  const handleBannerPress = () => {
    if (inAppNotification?.conversationId) {
      navigateToChatRoom(
        inAppNotification.conversationId,
        inAppNotification.conversationTitle
      );
      dismissInAppNotification();
    }
  };

  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.separator,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <MessageOutboxProvider key={`${baseUrl}:${user?.id || 'signed-out'}`}>
      <InAppNotificationBanner
        visible={Boolean(inAppNotification)}
        notification={inAppNotification}
        onPress={handleBannerPress}
        onDismiss={dismissInAppNotification}
      />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <TabNavigator />
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} animated={!reduceMotion} />
    </MessageOutboxProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <NotificationProvider>
                <AppContent />
              </NotificationProvider>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
