import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Linking, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllDataForBackup, importBackupData, clearAllTransactions } from '../database/db';
import { exportToCSV } from '../utils/export';
import { pickAndParseCSV, importRows } from '../utils/import';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Radius } from '../theme/radius';
import { Typography } from '../theme/typography';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppVersion } from '../utils/version';
import Card from '../components/ui/Card';
import GradientHero from '../components/ui/GradientHero';

const BACKUP_FILENAME = 'FinanceApp_Backup.json';

export default function ProfileScreen({ navigation }) {
  const { currency } = useCurrency();
  const { t } = useLanguage();
  const appVersion = useAppVersion(t('locale'));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [section, setSection] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try { await exportToCSV(); }
    catch (e) { Alert.alert(t('export_error_title'), e.message); }
    finally { setExporting(false); }
  };

  const handleClear = () => {
    Alert.alert(t('clear_all_title'), t('clear_all_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('clear_all_btn'), style: 'destructive', onPress: async () => {
        setClearing(true);
        try { await clearAllTransactions(); Alert.alert(t('done'), t('ops_removed')); }
        catch (e) { Alert.alert(t('error'), e.message); }
        finally { setClearing(false); }
      }},
    ]);
  };

  const handlePickImport = async () => {
    try {
      const rows = await pickAndParseCSV();
      if (!rows) return;
      if (rows.length === 0) { Alert.alert(t('file_empty'), t('file_empty_msg')); return; }
      setPreview(rows);
    } catch (e) { Alert.alert(t('read_error_title'), e.message); }
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const count = await importRows(preview, currency.code);
      setPreview(null);
      Alert.alert(`${t('done')} ✓`, `${t('imported_success_pre')} ${count} ${t('import_found_suf')}`);
    } catch (e) { Alert.alert(t('import_error_title'), e.message); }
    finally { setImporting(false); }
  };

  const backupLocally = async () => {
    setLoading(true);
    try {
      const backup = await getAllDataForBackup();
      const content = JSON.stringify(backup, null, 2);
      const fileUri = FileSystem.documentDirectory + BACKUP_FILENAME;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: t('backup_create'),
          UTI: 'public.json',
        });
      } else {
        Alert.alert(t('done'), fileUri);
      }
    } catch (e) {
      Alert.alert(t('backup_error_title'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const restoreLocally = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
      let backup;
      try {
        backup = JSON.parse(content);
      } catch {
        Alert.alert(t('error'), t('file_corrupt'));
        return;
      }

      if (!backup.transactions || !backup.categories) {
        Alert.alert(t('error'), t('not_backup_file'));
        return;
      }

      Alert.alert(
        t('restore_confirm_title'),
        `${t('import_found_pre')} ${backup.transactions.length} ${t('import_found_suf')}, ${backup.categories.length} ${t('categories').toLowerCase()}.\n\n${t('restore_replace_warning')}`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('restore_btn'), style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                await importBackupData(backup);
                Alert.alert(t('done'), `${t('restore_success')} ${backup.transactions.length} ${t('import_found_suf')}`);
              } catch (e) {
                Alert.alert(t('restore_error_title'), e.message);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(t('open_error_title'), e.message);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Header ── */}
        <GradientHero style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={s.userName}>{t('my_profile')}</Text>
          <Text style={s.userSub}>FinanceApp {appVersion}</Text>
        </GradientHero>

        <View style={{ height: Spacing.lg }} />

        {/* ── Резервное копирование ── */}
        <SectionCard
          title={t('backup')}
          icon="cloud"
          color={Colors.primary}
          expanded={section === 'backup'}
          onToggle={() => setSection(section === 'backup' ? null : 'backup')}
        >
          <View style={s.backupBlock}>
            <Text style={s.sectionSubtitle}>{t('backup_sub')}</Text>

            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
              <Text style={s.infoTxt}>{t('backup_info')}</Text>
            </View>

            <BackupAction
              icon="cloud-upload"
              label={t('backup_create')}
              sub={t('backup_create_sub')}
              color={Colors.primary}
              loading={loading}
              onPress={backupLocally}
            />
            <BackupAction
              icon="cloud-download"
              label={t('backup_restore')}
              sub={t('backup_restore_sub')}
              color={Colors.income}
              loading={loading}
              onPress={restoreLocally}
            />
          </View>
        </SectionCard>

        {/* ── Данные ── */}
        <SectionCard
          title={t('data')}
          icon="server-outline"
          color={Colors.income}
          expanded={section === 'data'}
          onToggle={() => setSection(section === 'data' ? null : 'data')}
        >
          <View style={s.dataBlock}>
            <BackupAction icon="download-outline" label={t('export_csv')} sub={t('export_csv_sub')} color={Colors.income} loading={exporting} onPress={handleExport} />
            <BackupAction icon="cloud-upload-outline" label={t('import_csv')} sub={t('import_csv_sub')} color={Colors.primary} loading={importing} onPress={handlePickImport} />
            <BackupAction icon="trash-outline" label={t('clear_data')} sub={t('clear_data_sub')} color={Colors.expense} loading={clearing} onPress={handleClear} />
          </View>
          <View style={s.csvHint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            <Text style={s.csvHintTxt}>{t('csv_format_hint')}</Text>
          </View>
        </SectionCard>

        {/* ── Оценить нас ── */}
        <SectionCard
          title={t('rate_us')}
          icon="star"
          color="#FF9F43"
          expanded={section === 'rate'}
          onToggle={() => setSection(section === 'rate' ? null : 'rate')}
        >
          <View style={s.rateBlock}>
            <Text style={s.rateText}>{t('rate_text')}</Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name="star" size={32} color="#FF9F43" />
              ))}
            </View>
            <TouchableOpacity
              style={s.rateBtn}
              onPress={() => Linking.openURL('https://play.google.com/store/apps')}
            >
              <Text style={s.rateBtnTxt}>{t('rate_btn')}</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Служба поддержки ── */}
        <SectionCard
          title={t('support')}
          icon="headset"
          color="#00C48C"
          expanded={section === 'support'}
          onToggle={() => setSection(section === 'support' ? null : 'support')}
        >
          <View style={s.supportBlock}>
            <SupportRow
              icon="mail"
              label={t('support_email_label')}
              sub="support@financeapp.app"
              onPress={() => Linking.openURL('mailto:support@financeapp.app')}
            />
            <SupportRow
              icon="help-circle"
              label={t('support_faq')}
              sub={t('support_faq_sub')}
              onPress={() => Alert.alert(t('support_faq_title'), t('support_faq_msg'))}
            />
            <SupportRow
              icon="bug"
              label={t('support_bug')}
              sub={t('support_bug_sub')}
              onPress={() => Linking.openURL('mailto:bugs@financeapp.app?subject=Bug%20Report')}
            />
          </View>
        </SectionCard>

        {/* ── О программе ── */}
        <SectionCard
          title={t('about')}
          icon="information-circle"
          color={Colors.textSecondary}
          expanded={section === 'about'}
          onToggle={() => setSection(section === 'about' ? null : 'about')}
        >
          <View style={s.aboutBlock}>
            <AboutRow label={t('app_version')}    value={appVersion} />
            <AboutRow label={t('about_platform')} value={t('about_platform_value')} />
            <AboutRow label={t('about_db')}       value={t('about_db_value')} />
            <AboutRow label={t('about_dev')}      value={t('about_dev_value')} />
            <AboutRow label={t('about_release')}  value="2025" />
            <Text style={s.aboutNote}>{t('about_note')}</Text>
          </View>
        </SectionCard>

      </ScrollView>

      {/* Import Preview Modal */}
      <Modal visible={!!preview} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('import_preview')}</Text>
              <TouchableOpacity onPress={() => setPreview(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>{t('import_found_pre')} {preview?.length || 0} {t('import_found_suf')}</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {preview?.slice(0, 20).map((row, i) => (
                <View key={i} style={s.previewRow}>
                  <View style={[s.previewDot, { backgroundColor: row.type === 'income' ? Colors.income : Colors.expense }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.previewCat}>{row.categoryName || t('no_category')} · {row.date}</Text>
                    {row.note ? <Text style={s.previewNote}>{row.note}</Text> : null}
                  </View>
                  <Text style={[s.previewAmt, { color: row.type === 'income' ? Colors.income : Colors.expense }]}>
                    {row.type === 'income' ? '+' : '−'}{row.amount}
                  </Text>
                </View>
              ))}
              {(preview?.length || 0) > 20 && (
                <Text style={s.moreText}>{t('import_more')} {preview.length - 20} {t('import_found_suf')}</Text>
              )}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPreview(null)}>
                <Text style={s.cancelTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmImport} disabled={importing}>
                {importing ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmTxt}>{t('import_btn')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function SectionCard({ title, icon, color, children, expanded, onToggle }) {
  return (
    <Card style={s.sectionCard}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.sectionIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      {expanded && <View style={s.sectionBody}>{children}</View>}
    </Card>
  );
}

function BackupAction({ icon, label, sub, color, loading, onPress }) {
  return (
    <TouchableOpacity style={s.backupActionRow} onPress={onPress} activeOpacity={0.75} disabled={loading}>
      <View style={[s.backupActionIcon, { backgroundColor: color + '18' }]}>
        {loading
          ? <ActivityIndicator size="small" color={color} />
          : <Ionicons name={icon} size={20} color={color} />
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.backupActionLabel}>{label}</Text>
        <Text style={s.backupActionSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function SupportRow({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity style={s.supportRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.supportIcon, { backgroundColor: Colors.primaryLight }]}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.supportLabel}>{label}</Text>
        <Text style={s.supportSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function AboutRow({ label, value }) {
  return (
    <View style={s.aboutRow}>
      <Text style={s.aboutLabel}>{label}</Text>
      <Text style={s.aboutValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', top: 56, left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  userSub:  { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  sectionCard: {
    marginHorizontal: Spacing.lg, marginBottom: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  sectionSubtitle: { fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  backupBlock: { gap: 8 },
  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    padding: Spacing.md, marginBottom: 4,
  },
  infoTxt: { flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 18 },
  backupActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgInput, borderRadius: 12, padding: Spacing.md,
  },
  backupActionIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  backupActionLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  backupActionSub:   { fontSize: 11, color: Colors.textMuted },

  rateBlock: { alignItems: 'center', gap: 14 },
  rateText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  starsRow: { flexDirection: 'row', gap: 6 },
  rateBtn: { backgroundColor: '#FF9F43', borderRadius: 12, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md },
  rateBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  supportBlock: { gap: 4 },
  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  supportIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  supportLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  supportSub:   { fontSize: 12, color: Colors.textMuted },

  aboutBlock: { gap: 2 },
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  aboutLabel: { fontSize: 13, color: Colors.textSecondary },
  aboutValue: { fontSize: 13, fontWeight: '600', color: Colors.text },
  aboutNote:  { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: Spacing.md },

  dataBlock: { gap: 8 },
  csvHint: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: Spacing.md, marginTop: Spacing.sm,
  },
  csvHintTxt: { flex: 1, fontSize: 11, color: Colors.primary, lineHeight: 17 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { ...Typography.title },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.lg },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  previewCat: { fontSize: 13, fontWeight: '600', color: Colors.text },
  previewNote: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  previewAmt: { fontSize: 13, fontWeight: '700' },
  moreText: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, paddingVertical: 10 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.bgMuted },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
