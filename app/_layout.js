import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Modal, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import * as Updates from 'expo-updates';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { LanguageProvider } from '../src/context/LanguageContext';

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

export default function RootLayout() {
  const { available, downloading, apply, dismiss } = useOTAUpdate();

  return (
    <LanguageProvider>
      <CurrencyProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />

        <Modal visible={available} transparent animationType="fade">
          <View style={d.overlay}>
            <View style={d.card}>
              <View style={d.iconWrap}>
                <Text style={d.icon}>🚀</Text>
              </View>
              <Text style={d.title}>Доступно обновление</Text>
              <Text style={d.body}>
                Новая версия готова к установке. Обновление займёт несколько секунд.
              </Text>

              <TouchableOpacity
                style={d.primaryBtn}
                onPress={apply}
                disabled={downloading}
                activeOpacity={0.85}
              >
                {downloading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={d.primaryTxt}>Обновить сейчас</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={d.secondaryBtn}
                onPress={dismiss}
                disabled={downloading}
                activeOpacity={0.7}
              >
                <Text style={d.secondaryTxt}>Позже</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#EDE9FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  icon:        { fontSize: 32 },
  title:       { fontSize: 20, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  body:        { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  primaryBtn:  {
    width: '100%', backgroundColor: '#6C47FF',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, minHeight: 52,
  },
  primaryTxt:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn:{ width: '100%', paddingVertical: 12, alignItems: 'center' },
  secondaryTxt:{ fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
});
