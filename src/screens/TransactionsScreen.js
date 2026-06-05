import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, StatusBar,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getTransactions, deleteTransaction } from '../database/db';
import { formatDate } from '../utils/format';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'income', label: 'Доходы' },
  { key: 'expense', label: 'Расходы' },
];

export default function TransactionsScreen({ navigation }) {
  const { currency, fmt } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const t = await getTransactions({
      limit: 500,
      type: filter === 'all' ? undefined : filter,
      currency: currency.code,
    });
    setTransactions(t);
  }, [filter, currency.code]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id) => {
    Alert.alert('Удалить?', 'Операция будет удалена безвозвратно', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await deleteTransaction(id);
        load();
      }},
    ]);
  };

  const filtered = search
    ? transactions.filter(t =>
        t.category_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.note?.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  // Group by date
  const grouped = [];
  let lastDate = null;
  for (const t of filtered) {
    if (t.date !== lastDate) {
      grouped.push({ type: 'header', date: t.date, key: 'h_' + t.date });
      lastDate = t.date;
    }
    grouped.push({ ...t, type: 'item', key: String(t.id) });
  }

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={s.dateHeader}>{formatDate(item.date)}</Text>;
    }
    const isIncome = item.type === 'income';
    return (
      <View style={s.item}>
        <View style={[s.icon, { backgroundColor: (item.category_color || Colors.primary) + '18' }]}>
          <Ionicons name={item.category_icon || 'ellipse'} size={20} color={item.category_color || Colors.primary} />
        </View>
        <View style={s.info}>
          <Text style={s.category}>{item.category_name || 'Без категории'}</Text>
          {item.note ? <Text style={s.note} numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <View style={s.right}>
          <Text style={[s.amount, { color: isIncome ? Colors.income : Colors.expense }]}>
            {isIncome ? '+' : '−'}{fmt(item.amount)}
          </Text>
          <View style={s.itemActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddTransaction', { transaction: item })}
              style={s.actionBtn}
            >
              <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.actionBtn}>
              <Ionicons name="trash-outline" size={15} color={Colors.expense} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const totalFiltered = filtered.reduce((s, t) => {
    if (t.type === 'income') return { ...s, income: s.income + t.amount };
    return { ...s, expense: s.expense + t.amount };
  }, { income: 0, expense: 0 });

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.title}>Операции</Text>
          <View style={[s.currBadge, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[s.currBadgeTxt, { color: Colors.primary }]}>{currency.flag} {currency.code}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('AddTransaction')}>
          <LinearGradientInline />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по категории, заметке..."
          placeholderTextColor={Colors.textMuted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterBtn, filter === f.key && s.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterTxt, filter === f.key && s.filterTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.filterSummary}>
          <Text style={s.summaryTxt}>
            <Text style={{ color: Colors.income }}>+{fmt(totalFiltered.income)}</Text>
            {'  '}
            <Text style={{ color: Colors.expense }}>−{fmt(totalFiltered.expense)}</Text>
          </Text>
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="receipt-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>Нет операций</Text>
            <Text style={s.emptyText}>Добавьте первую запись через +</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function LinearGradientInline() {
  return (
    <LinearGradient colors={['#6C47FF', '#9B6BFF']} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="add" size={22} color="#fff" />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  currBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  currBadgeTxt: { fontSize: 11, fontWeight: '700' },
  addBtn: { borderRadius: 20, overflow: 'hidden' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.bgCard, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4, gap: 6, alignItems: 'center' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  filterTxtActive: { color: Colors.primary },
  filterSummary: { flex: 1, alignItems: 'flex-end' },
  summaryTxt: { fontSize: 12, fontWeight: '600' },

  dateHeader: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 16, paddingBottom: 8 },

  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: 16, padding: 12, marginBottom: 8, gap: 12, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  category: { fontSize: 14, fontWeight: '600', color: Colors.text },
  note: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700' },
  itemActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted },
});
