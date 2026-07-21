import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Modal, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import * as Updates from 'expo-updates';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { Colors } from '../src/theme/colors';
import { Spacing } from '../src/theme/spacing';
import { Radius } from '../src/theme/radius';

function useOTAUpdate() {
  const [available,   setAvailable]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const appState = useRef(AppState.currentState);

  const check = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setAvailable(true);
    } catch (_) {}
  };

  // Check on mount and every time the app comes to foreground
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        check();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const apply = async () => {
    setDownloading(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (_) {
      setDownloading(false);
    }
  };

  return { available, downloading, apply, dismiss: () => setAvailable(false) };
}

// Rendered inside the providers so it can use translations.
function UpdateModal() {
  const { t } = useLanguage();
  const { available, downloading, apply, dismiss } = useOTAUpdate();

  return (
    <Modal visible={available} transparent animationType="fade">
      <View style={d.overlay}>
        <View style={d.card}>
          <View style={d.iconWrap}>
            <Text style={d.icon}>🚀</Text>
          </View>
          <Text style={d.title}>{t('update_title')}</Text>
          <Text style={d.body}>{t('update_body')}</Text>

          <TouchableOpacity
            style={d.primaryBtn}
            onPress={apply}
            disabled={downloading}
            activeOpacity={0.85}
          >
            {downloading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={d.primaryTxt}>{t('update_now')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={d.secondaryBtn}
            onPress={dismiss}
            disabled={downloading}
            activeOpacity={0.7}
          >
            <Text style={d.secondaryTxt}>{t('update_later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        <UpdateModal />
      </CurrencyProvider>
    </LanguageProvider>
  );
}

const d = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  icon:        { fontSize: 32 },
  title:       { fontSize: 20, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  body:        { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.sm },
  primaryBtn:  {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs, minHeight: 52,
  },
  primaryTxt:  { fontSize: 16, fontWeight: '700', color: Colors.white },
  secondaryBtn:{ width: '100%', paddingVertical: Spacing.md, alignItems: 'center' },
  secondaryTxt:{ fontSize: 15, fontWeight: '600', color: Colors.textMuted },
});
