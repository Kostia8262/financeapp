import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { CURRENCIES } from '../utils/currencies';
import { useAppVersion } from '../utils/version';

export default function SettingsScreen() {
  const { currency, setCurrency } = useCurrency();
  const { lang, setLang, LANGUAGES, t } = useLanguage();
  const appVersion = useAppVersion(t('locale'));

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{t('settings')}</Text>

        {/* Currency section */}
        <Text style={s.sectionLabel}>{t('currency_account')}</Text>
        <View style={s.currencyCard}>
          <View style={s.activeCurrencyRow}>
            <Text style={s.activeCurrencyFlag}>{currency.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.activeCurrencyName}>{currency.name}</Text>
              <Text style={s.activeCurrencyHint}>{t('active_currency')}</Text>
            </View>
            <View style={s.activeCurrencyBadge}>
              <Text style={s.activeCurrencyCode}>{currency.symbol} {currency.code}</Text>
            </View>
          </View>
          <View style={s.currencyGrid}>
            {CURRENCIES.map(c => {
              const isActive = c.code === currency.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[s.currencyPill, isActive && s.currencyPillActive]}
                  onPress={() => setCurrency(c)}
                  activeOpacity={0.75}
                >
                  <Text style={s.currencyPillFlag}>{c.flag}</Text>
                  <Text style={[s.currencyPillSymbol, isActive && { color: Colors.primary }]}>
                    {c.symbol}
                  </Text>
                  <Text style={[s.currencyPillCode, isActive && { color: Colors.primary }]}>
                    {c.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Language section */}
        <Text style={s.sectionLabel}>{t('language')}</Text>
        <View style={s.card}>
          <View style={s.langGrid}>
            {LANGUAGES.map(l => {
              const isActive = l.code === lang;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[s.langPill, isActive && s.langPillActive]}
                  onPress={() => setLang(l.code)}
                  activeOpacity={0.75}
                >
                  <Text style={s.langFlag}>{l.flag}</Text>
                  <Text style={[s.langName, isActive && { color: Colors.primary }]}>{l.name}</Text>
                  {isActive && (
                    <View style={s.langCheck}>
                      <Ionicons name="checkmark" size={12} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* About */}
        <Text style={s.sectionLabel}>{t('about_app')}</Text>
        <View style={s.card}>
          <View style={s.aboutContent}>
            <LinearGradient colors={['#6C47FF', '#9B6BFF']} style={s.appIconWrap}>
              <Ionicons name="wallet" size={28} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={s.appName}>Finance Tracker</Text>
              <Text style={s.appVersion}>{appVersion}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.offlineRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.income} />
            <Text style={s.offlineText}>{t('offline_notice')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, paddingHorizontal: 20, paddingTop: 56, marginBottom: 20, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginBottom: 10 },

  // Currency picker
  currencyCard: { marginHorizontal: 16, marginBottom: 20, backgroundColor: Colors.bgCard, borderRadius: 20, overflow: 'hidden', elevation: 3, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, padding: 16 },
  activeCurrencyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 12 },
  activeCurrencyFlag: { fontSize: 28 },
  activeCurrencyName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  activeCurrencyHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  activeCurrencyBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  activeCurrencyCode: { color: '#fff', fontSize: 13, fontWeight: '800' },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: 'transparent' },
  currencyPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  currencyPillFlag: { fontSize: 14 },
  currencyPillSymbol: { fontSize: 14, fontWeight: '800', color: Colors.text },
  currencyPillCode: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  card: { marginHorizontal: 16, marginBottom: 20, backgroundColor: Colors.bgCard, borderRadius: 20, overflow: 'hidden', shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 72 },

  langGrid: { padding: 16, gap: 8 },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: Colors.bgInput,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  langPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  langFlag: { fontSize: 22 },
  langName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  langCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  aboutContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  appIconWrap: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  appVersion: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  offlineRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  offlineText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
