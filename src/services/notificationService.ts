import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let isConfigured = false;

/**
 * Configure default foreground notification behavior for expo-notifications.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web' || isConfigured) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    isConfigured = true;
  } catch (err) {
    console.warn('[NotificationService] Failed to set notification handler:', err);
  }
}

/**
 * Configure Android notification channel with high priority and vibration.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn('[NotificationService] Android channel setup error:', err);
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
  } catch (err) {
    console.warn('[NotificationService] Permission request failed:', err);
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
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: 'default',
        priority: 'max',
        vibrate: [0, 250, 250, 250],
        color: '#007AFF',
      },
      trigger: null, // deliver immediately
    });
    return id;
  } catch (err) {
    console.warn('[NotificationService] Failed to present local notification:', err);
    return null;
  }
}
