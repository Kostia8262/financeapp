import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Modal, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { exportToCSV } from '../utils/export';
import { pickAndParseCSV, importRows } from '../utils/import';
import { clearAllTransactions } from '../database/db';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { CURRENCIES } from '../utils/currencies';

export default function SettingsScreen() {
  const { currency, setCurrency } = useCurrency();
  const { lang, setLang, LANGUAGES, t } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [preview, setPreview] = useState(null); // parsed rows before import

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToCSV();
    } catch (e) {
      Alert.alert('Ошибка экспорта', e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Очистить все данные?',
      'Все операции будут удалены безвозвратно. Категории останутся.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Очистить', style: 'destructive', onPress: async () => {
          setClearing(true);
          try {
            await clearAllTransactions();
            Alert.alert('Готово', 'Все операции удалены');
          } catch (e) {
            Alert.alert('Ошибка', e.message);
          } finally {
            setClearing(false);
          }
        }},
      ]
    );
  };

  const handlePickImport = async () => {
    try {
      const rows = await pickAndParseCSV();
      if (!rows) return;
      if (rows.length === 0) { Alert.alert('Файл пустой', 'Не найдено ни одной операции'); return; }
      setPreview(rows);
    } catch (e) {
      Alert.alert('Ошибка чтения', e.message);
    }
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const count = await importRows(preview);
      setPreview(null);
      Alert.alert('Готово ✓', `Импортировано ${count} операций`);
    } catch (e) {
      Alert.alert('Ошибка импорта', e.message);
    } finally {
      setImporting(false);
    }
  };

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
              <Text style={s.appVersion}>{t('app_version')}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.offlineRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.income} />
            <Text style={s.offlineText}>{t('offline_notice')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Import Preview Modal */}
      <Modal visible={!!preview} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Предпросмотр импорта</Text>
              <TouchableOpacity onPress={() => setPreview(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>Найдено {preview?.length || 0} операций</Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {preview?.slice(0, 20).map((row, i) => (
                <View key={i} style={s.previewRow}>
                  <View style={[s.previewDot, { backgroundColor: row.type === 'income' ? Colors.income : Colors.expense }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.previewCat}>{row.categoryName || 'Без категории'} · {row.date}</Text>
                    {row.note ? <Text style={s.previewNote}>{row.note}</Text> : null}
                  </View>
                  <Text style={[s.previewAmt, { color: row.type === 'income' ? Colors.income : Colors.expense }]}>
                    {row.type === 'income' ? '+' : '−'}{row.amount}
                  </Text>
                </View>
              ))}
              {(preview?.length || 0) > 20 && (
                <Text style={s.moreText}>...и ещё {preview.length - 20} операций</Text>
              )}
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPreview(null)}>
                <Text style={s.cancelTxt}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmImport} disabled={importing}>
                {importing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmTxt}>Импортировать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SettingRow({ icon, iconBg, iconColor, label, sub, onPress, loading, arrow }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={loading} activeOpacity={0.7}>
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
        {loading
          ? <ActivityIndicator size="small" color={iconColor} />
          : <Ionicons name={icon} size={20} color={iconColor} />}
      </View>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {arrow && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

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

  hintCard: { marginHorizontal: 16, marginBottom: 28, backgroundColor: Colors.primaryLight, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12 },
  hintTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  hintText: { fontSize: 12, color: Colors.primary, lineHeight: 18, opacity: 0.85 },
  hintCode: { fontWeight: '700' },

  aboutContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  appIconWrap: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  appVersion: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  offlineRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  offlineText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  previewCat: { fontSize: 13, fontWeight: '600', color: Colors.text },
  previewNote: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  previewAmt: { fontSize: 13, fontWeight: '700' },
  moreText: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, paddingVertical: 10 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.bgMuted },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
