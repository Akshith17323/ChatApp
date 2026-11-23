import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

let isConfigured = false;
let isChannelConfigured = false;

/**
 * Configure default foreground notification behavior for expo-notifications.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web' || isConfigured) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    isConfigured = true;
  } catch {
    // Non-fatal in web or headless preview environments
  }
}

/**
 * Configure Android notification channel with high priority and vibration.
 * Note: 'sound' should NOT be set to 'default' as Android requires omitting it or null
 * to use the system default ringtone; passing a string attempts a raw resource lookup.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android' || isChannelConfigured) return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
      enableVibrate: true,
      showBadge: true,
    });
    isChannelConfigured = true;
  } catch {
    // Expo Go on Android has limited support for custom notification channels (SDK 53+).
    // Standalone APK builds compile full native channels cleanly.
    isChannelConfigured = true;
  }
}

/**
 * Request system notification permissions on native platforms.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule an immediate local system notification.
 */
export async function presentLocalNotification(params: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const trigger =
      Platform.OS === 'android'
        ? ({ channelId: 'default' } as const)
        : null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: true,
      },
      trigger,
    });
    return id;
  } catch {
    // Expo Go has Android SDK 53+ push/local limitations, in-app banner acts as primary fallback
    return null;
  }
}

/**
 * Retrieves the native FCM device push token for background notifications.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}
