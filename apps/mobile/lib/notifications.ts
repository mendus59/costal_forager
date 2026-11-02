/**
 * Push alerts. The server (supabase/functions/send-alerts) decides what to
 * send; the app only asks permission and registers this device's Expo push
 * token with the signed-in account.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export const pushSupported = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

/**
 * Asks for permission and stores this device's push token on the account.
 * Returns a sentence for the user when it cannot.
 */
export async function registerForPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Device.isDevice) return { ok: false, reason: 'Alerts need a real phone, not a simulator.' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Good-day alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return { ok: false, reason: 'Notifications are turned off for this app in system settings.' };
  const id = projectId();
  if (!id) return { ok: false, reason: 'This build has no EAS project ID, so it cannot receive push alerts.' };
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const { error } = await supabase.rpc('claim_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Opens the beach an alert is about when the user taps it. */
export function listenForTaps(): () => void {
  const open = (r: Notifications.NotificationResponse | null) => {
    const bidn = r?.notification.request.content.data?.bidn;
    if (typeof bidn === 'string') router.push({ pathname: '/beach/[bidn]', params: { bidn } });
  };
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
