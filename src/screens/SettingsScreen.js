import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Radius } from '../theme/radius';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { CURRENCIES } from '../utils/currencies';
import { useAppVersion } from '../utils/version';
import Card from '../components/ui/Card';

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
        <Card style={s.currencyCard} padding={16}>
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
        </Card>

        {/* Language section */}
        <Text style={s.sectionLabel}>{t('language')}</Text>
        <Card style={s.card}>
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
        </Card>

        {/* About */}
        <Text style={s.sectionLabel}>{t('about_app')}</Text>
        <Card style={s.card}>
          <View style={s.aboutContent}>
            <LinearGradient colors={[Colors.primary, '#9B6BFF']} style={s.appIconWrap}>
              <Ionicons name="wallet" size={28} color={Colors.white} />
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
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { ...Typography.h1, paddingHorizontal: Spacing.xl, paddingTop: 56, marginBottom: Spacing.xl },
  sectionLabel: { ...Typography.sectionLabel, marginHorizontal: Spacing.xl, marginBottom: 10 },

  // Currency picker
  currencyCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  activeCurrencyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md },
  activeCurrencyFlag: { fontSize: 28 },
  activeCurrencyName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  activeCurrencyHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  activeCurrencyBadge: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  activeCurrencyCode: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  currencyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 12, backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: 'transparent' },
  currencyPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  currencyPillFlag: { fontSize: 14 },
  currencyPillSymbol: { fontSize: 14, fontWeight: '800', color: Colors.text },
  currencyPillCode: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 72 },

  langGrid: { padding: Spacing.lg, gap: Spacing.sm },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: Spacing.md,
    borderRadius: Radius.md, backgroundColor: Colors.bgInput,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  langPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  langFlag: { fontSize: 22 },
  langName: { ...Typography.body, flex: 1 },
  langCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  aboutContent: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: 14 },
  appIconWrap: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  appVersion: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  offlineRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.lg, gap: 10 },
  offlineText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
