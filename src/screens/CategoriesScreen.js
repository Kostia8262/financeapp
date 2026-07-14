import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, StatusBar, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../database/db';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Radius } from '../theme/radius';
import { useLanguage } from '../context/LanguageContext';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';

const ICONS = [
  'fast-food', 'car', 'home', 'medkit', 'game-controller', 'shirt',
  'school', 'phone-portrait', 'cafe', 'barbell', 'briefcase', 'laptop',
  'trending-up', 'gift', 'wallet', 'cart', 'airplane', 'bus',
  'restaurant', 'fitness', 'heart', 'musical-notes', 'book', 'ellipse',
];

const PALETTE = [
  '#FF5A5F', '#FF6B6B', '#FF9F43', '#FFC312', '#A3CB38',
  '#00C48C', '#0BE881', '#17C0EB', '#0652DD', '#6C47FF',
  '#A78BFA', '#C084FC', '#EC407A', '#FF4081', '#795548',
  '#607D8B', '#9E9E9E', '#455A64',
];

export default function CategoriesScreen() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('expense');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add mode, id = edit mode
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [icon, setIcon] = useState(ICONS[0]);

  const load = useCallback(async () => {
    const c = await getCategories(tab);
    setCategories(c);
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setColor(PALETTE[0]);
    setIcon(ICONS[0]);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setColor(item.color);
    setIcon(item.icon);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('error'), t('cat_error_empty')); return; }
    if (editingId) {
      await updateCategory(editingId, { name: name.trim(), color, icon });
    } else {
      await addCategory({ name: name.trim(), type: tab, color, icon });
    }
    setShowModal(false);
    load();
  };

  const handleDelete = (id, catName) => {
    Alert.alert(t('delete_cat_title'), `"${catName}" ${t('delete_cat_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await deleteCategory(id);
        load();
      }},
    ]);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <View style={s.header}>
        <Text style={s.title}>{t('categories')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.tabWrap}>
        <TouchableOpacity
          style={[s.tab, tab === 'expense' && { backgroundColor: Colors.expense }]}
          onPress={() => setTab('expense')}
        >
          <Text style={[s.tabTxt, tab === 'expense' && { color: Colors.white }]}>{t('expense')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'income' && { backgroundColor: Colors.income }]}
          onPress={() => setTab('income')}
        >
          <Text style={[s.tabTxt, tab === 'income' && { color: Colors.white }]}>{t('income')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card style={s.item} variant="row" radius={16} padding={14}>
            <View style={[s.itemIcon, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={s.itemName}>{item.name}</Text>
            <TouchableOpacity onPress={() => openEdit(item)} style={s.actionBtn}>
              <Ionicons name="pencil-outline" size={17} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={s.actionBtn}>
              <Ionicons name="trash-outline" size={17} color={Colors.textMuted} />
            </TouchableOpacity>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState icon="grid-outline" title={t('no_cats')} subtitle={t('tap_plus_to_add')} />
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingId ? t('edit_category') : t('new_category')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder={t('category_name')}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            {/* Preview */}
            <View style={s.preview}>
              <View style={[s.previewIcon, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={28} color={color} />
              </View>
              <Text style={[s.previewName, { color }]}>{name || 'Название'}</Text>
            </View>

            <Text style={s.subLabel}>{t('color')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={s.colorRow}>
                {PALETTE.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorDot, { backgroundColor: c }, color === c && s.colorSelected]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>
            </ScrollView>

            <Text style={s.subLabel}>{t('icon')}</Text>
            <View style={s.iconGrid}>
              {ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[s.iconBtn, icon === ic && { backgroundColor: color + '20', borderColor: color }]}
                  onPress={() => setIcon(ic)}
                >
                  <Ionicons name={ic} size={20} color={icon === ic ? color : Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleSave}>
                <Text style={s.confirmTxt}>{editingId ? t('save') : t('add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: Spacing.md },
  title: { ...Typography.h1 },
  addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  tabWrap: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 4, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.sm },
  tabTxt: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  item: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.md },
  itemIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  actionBtn: { padding: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { ...Typography.title },

  input: { backgroundColor: Colors.bgInput, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, color: Colors.text, fontSize: 15, marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: Colors.border },

  preview: { alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm },
  previewIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 15, fontWeight: '700' },

  subLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  colorRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 2 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorSelected: { borderWidth: 3, borderColor: Colors.white, transform: [{ scale: 1.1 }] },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.border },

  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.bgMuted },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
