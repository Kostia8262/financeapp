import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, Linking, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllDataForBackup, importBackupData, clearAllTransactions } from '../database/db';
import { exportToCSV } from '../utils/export';
import { pickAndParseCSV, importRows } from '../utils/import';
import { Colors } from '../theme/colors';

const APP_VERSION = '1.0.0';
const BACKUP_FILENAME = 'FinanceApp_Backup.json';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [section, setSection] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try { await exportToCSV(); }
    catch (e) { Alert.alert('Ошибка экспорта', e.message); }
    finally { setExporting(false); }
  };

  const handleClear = () => {
    Alert.alert('Очистить все данные?', 'Все операции будут удалены безвозвратно. Категории останутся.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Очистить', style: 'destructive', onPress: async () => {
        setClearing(true);
        try { await clearAllTransactions(); Alert.alert('Готово', 'Все операции удалены'); }
        catch (e) { Alert.alert('Ошибка', e.message); }
        finally { setClearing(false); }
      }},
    ]);
  };

  const handlePickImport = async () => {
    try {
      const rows = await pickAndParseCSV();
      if (!rows) return;
      if (rows.length === 0) { Alert.alert('Файл пустой', 'Не найдено ни одной операции'); return; }
      setPreview(rows);
    } catch (e) { Alert.alert('Ошибка чтения', e.message); }
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const count = await importRows(preview);
      setPreview(null);
      Alert.alert('Готово ✓', `Импортировано ${count} операций`);
    } catch (e) { Alert.alert('Ошибка импорта', e.message); }
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
          dialogTitle: 'Сохранить резервную копию',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Готово', `Файл сохранён: ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось создать резервную копию: ${e.message}`);
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
        Alert.alert('Ошибка', 'Файл повреждён или имеет неверный формат.');
        return;
      }

      if (!backup.transactions || !backup.categories) {
        Alert.alert('Ошибка', 'Файл не является резервной копией FinanceApp.');
        return;
      }

      Alert.alert(
        'Восстановить данные?',
        `Найдено ${backup.transactions.length} операций и ${backup.categories.length} категорий.\n\nТекущие данные будут полностью заменены.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Восстановить', style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                await importBackupData(backup);
                Alert.alert('Успешно', `Восстановлено ${backup.transactions.length} операций.`);
              } catch (e) {
                Alert.alert('Ошибка', `Не удалось восстановить: ${e.message}`);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось открыть файл: ${e.message}`);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Header ── */}
        <LinearGradient
          colors={['#6C47FF', '#9B6BFF', '#C084FC']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={s.userName}>Мой профиль</Text>
          <Text style={s.userSub}>FinanceApp v{APP_VERSION}</Text>
        </LinearGradient>

        {/* ── Данные ── */}
        <SectionCard
          title="Резервное копирование"
          icon="cloud"
          color={Colors.primary}
          expanded={section === 'backup'}
          onToggle={() => setSection(section === 'backup' ? null : 'backup')}
        >
          <View style={s.backupBlock}>
            <Text style={s.sectionSubtitle}>Локальный файл · JSON</Text>

            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
              <Text style={s.infoTxt}>
                Данные сохраняются в файл на устройстве. Вы можете вручную загрузить его в Google Drive, iCloud или отправить в мессенджер.
              </Text>
            </View>

            <BackupAction
              icon="cloud-upload"
              label="Создать резервную копию"
              sub="Экспорт всех данных в JSON-файл"
              color={Colors.primary}
              loading={loading}
              onPress={backupLocally}
            />
            <BackupAction
              icon="cloud-download"
              label="Восстановить из файла"
              sub="Импорт данных из JSON-файла"
              color={Colors.income}
              loading={loading}
              onPress={restoreLocally}
            />
          </View>
        </SectionCard>

        {/* ── Данные ── */}
        <SectionCard
          title="Данные"
          icon="server-outline"
          color={Colors.income}
          expanded={section === 'data'}
          onToggle={() => setSection(section === 'data' ? null : 'data')}
        >
          <View style={s.dataBlock}>
            <BackupAction icon="download-outline" label="Экспорт в CSV" sub="Сохранить все операции в файл" color={Colors.income} loading={exporting} onPress={handleExport} />
            <BackupAction icon="cloud-upload-outline" label="Импорт из CSV" sub="Загрузить операции из файла" color={Colors.primary} loading={importing} onPress={handlePickImport} />
            <BackupAction icon="trash-outline" label="Очистить данные" sub="Удалить все операции (категории останутся)" color={Colors.expense} loading={clearing} onPress={handleClear} />
          </View>
          <View style={s.csvHint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            <Text style={s.csvHintTxt}>Формат CSV: Дата, Тип, Сумма, Категория, Заметка{'\n'}Тип: «Доход» / «Расход» · Дата: ДД.ММ.ГГГГ</Text>
          </View>
        </SectionCard>

        {/* ── Оценить нас ── */}
        <SectionCard
          title="Оценить нас"
          icon="star"
          color="#FF9F43"
          expanded={section === 'rate'}
          onToggle={() => setSection(section === 'rate' ? null : 'rate')}
        >
          <View style={s.rateBlock}>
            <Text style={s.rateText}>
              Если вам нравится FinanceApp, оставьте отзыв в Google Play — это помогает нам расти!
            </Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name="star" size={32} color="#FF9F43" />
              ))}
            </View>
            <TouchableOpacity
              style={s.rateBtn}
              onPress={() => Linking.openURL('https://play.google.com/store/apps')}
            >
              <Text style={s.rateBtnTxt}>Оценить в Google Play</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Служба поддержки ── */}
        <SectionCard
          title="Служба поддержки"
          icon="headset"
          color="#00C48C"
          expanded={section === 'support'}
          onToggle={() => setSection(section === 'support' ? null : 'support')}
        >
          <View style={s.supportBlock}>
            <SupportRow
              icon="mail"
              label="Написать нам"
              sub="support@financeapp.app"
              onPress={() => Linking.openURL('mailto:support@financeapp.app')}
            />
            <SupportRow
              icon="help-circle"
              label="FAQ / Справочник"
              sub="Часто задаваемые вопросы"
              onPress={() => Alert.alert('FAQ', 'Раздел справки находится в разработке.')}
            />
            <SupportRow
              icon="bug"
              label="Сообщить об ошибке"
              sub="Помогите нам стать лучше"
              onPress={() => Linking.openURL('mailto:bugs@financeapp.app?subject=Bug%20Report')}
            />
          </View>
        </SectionCard>

        {/* ── О программе ── */}
        <SectionCard
          title="О программе"
          icon="information-circle"
          color={Colors.textSecondary}
          expanded={section === 'about'}
          onToggle={() => setSection(section === 'about' ? null : 'about')}
        >
          <View style={s.aboutBlock}>
            <AboutRow label="Версия"         value={APP_VERSION} />
            <AboutRow label="Платформа"      value="Android (React Native + Expo)" />
            <AboutRow label="База данных"    value="SQLite (локально, офлайн)" />
            <AboutRow label="Разработчик"    value="FinanceApp Team" />
            <AboutRow label="Дата выпуска"   value="2025" />
            <Text style={s.aboutNote}>
              Все данные хранятся только на вашем устройстве. Мы не собираем и не передаём личные данные.
            </Text>
          </View>
        </SectionCard>

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
                {importing ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmTxt}>Импортировать</Text>}
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
    <View style={s.sectionCard}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.sectionIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      {expanded && <View style={s.sectionBody}>{children}</View>}
    </View>
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
    paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20,
    alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: 16,
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
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.bgCard, borderRadius: 20,
    elevation: 3, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionSubtitle: { fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  backupBlock: { gap: 8 },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    padding: 12, marginBottom: 4,
  },
  infoTxt: { flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 18 },
  backupActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgInput, borderRadius: 12, padding: 12,
  },
  backupActionIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  backupActionLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  backupActionSub:   { fontSize: 11, color: Colors.textMuted },

  rateBlock: { alignItems: 'center', gap: 14 },
  rateText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  starsRow: { flexDirection: 'row', gap: 6 },
  rateBtn: { backgroundColor: '#FF9F43', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  rateBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  supportBlock: { gap: 4 },
  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
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
  aboutNote:  { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 12 },

  dataBlock: { gap: 8 },
  csvHint: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, marginTop: 8,
  },
  csvHintTxt: { flex: 1, fontSize: 11, color: Colors.primary, lineHeight: 17 },

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
