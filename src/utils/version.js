import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export function useAppVersion(locale) {
  const base = Constants.expoConfig?.version ?? '1.0.0';
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) {
    return `v${base}`;
  }
  const d = new Date(Updates.createdAt);
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `v${base} · OTA ${date}, ${time}`;
}
