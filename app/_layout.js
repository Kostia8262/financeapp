import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { LanguageProvider } from '../src/context/LanguageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </CurrencyProvider>
    </LanguageProvider>
  );
}
