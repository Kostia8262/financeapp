import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, StatusBar, Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCategories, addTransaction, updateTransaction } from '../database/db';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';

const { width, height } = Dimensions.get('window');
const KEY_SIZE = (width - 0) / 5;

function todayISO() { return new Date().toISOString().slice(0, 10); }

function formatDateDisplay(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Сегодня, ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  if (diff === 1) return 'Вчера, ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function evaluate(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b !== 0 ? a / b : a;
  return b;
}

function roundDisplay(n) {
  const s = String(parseFloat(n.toFixed(4)));
  return s;
}

export default function AddTransactionScreen({ navigation, route }) {
  const { currency } = useCurrency();
  const editing = route.params?.transaction;

  const [type, setType] = useState(editing?.type || route.params?.initialType || 'expense');
  const [display, setDisplay] = useState(editing ? String(editing.amount) : '0');
  const [prevValue, setPrevValue] = useState(null);
  const [pendingOp, setPendingOp] = useState(null);
  const [justCalc, setJustCalc] = useState(false);
  const [note, setNote] = useState(editing?.note || '');
  const [date, setDate] = useState(editing?.date || todayISO());
  const [categoryId, setCategoryId] = useState(
    editing?.category_id || (route.params?.initialCategoryId ? Number(route.params.initialCategoryId) : null)
  );
  const [categories, setCategories] = useState([]);
  const [showCatPicker, setShowCatPicker] = useState(false);

  useEffect(() => {
    getCategories(type).then(cats => {
      setCategories(cats);
      // Always ensure a valid category is selected:
      // - for new: pick first
      // - for edit after type change: pick first if current cat not in list
      if (cats.length > 0) {
        const valid = cats.find(c => c.id === categoryId);
        if (!valid) setCategoryId(cats[0].id);
      }
    });
  }, [type]);

  const selectedCat = categories.find(c => c.id === categoryId);

  // ── Numpad handlers ───────────────────────────────────────────
  const pressDigit = useCallback((d) => {
    setDisplay(prev => {
      if (justCalc) { setJustCalc(false); return d; }
      if (prev === '0') return d;
      if (prev.replace('.', '').length >= 10) return prev;
      return prev + d;
    });
  }, [justCalc]);

  const pressDecimal = useCallback(() => {
    setDisplay(prev => {
      if (justCalc) { setJustCalc(false); return '0.'; }
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  }, [justCalc]);

  const pressOperator = useCallback((op) => {
    const cur = parseFloat(display) || 0;
    if (pendingOp && !justCalc) {
      const result = evaluate(prevValue, pendingOp, cur);
      setPrevValue(result);
      setDisplay(roundDisplay(result));
    } else {
      setPrevValue(cur);
    }
    setPendingOp(op);
    setJustCalc(true);
  }, [display, pendingOp, prevValue, justCalc]);

  const pressBackspace = useCallback(() => {
    setDisplay(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }, []);

  const pressCycleDate = useCallback(() => {
    setDate(prev => {
      const d = new Date(prev + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  const pressConfirm = useCallback(async () => {
    let amount = parseFloat(display) || 0;
    if (pendingOp && prevValue !== null && !justCalc) {
      amount = evaluate(prevValue, pendingOp, amount);
    }
    amount = Math.abs(parseFloat(amount.toFixed(2)));
    if (!amount || amount <= 0) { Alert.alert('Ошибка', 'Сумма должна быть больше нуля'); return; }
    // Always have a category — use first available as fallback
    const finalCatId = categoryId || categories[0]?.id || null;

    try {
      if (editing) {
        await updateTransaction(editing.id, { amount, type, categoryId: finalCatId, note, date, currency: editing.currency || currency.code });
      } else {
        await addTransaction({ amount, type, categoryId: finalCatId, note, date, currency: currency.code });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    }
  }, [display, pendingOp, prevValue, justCalc, type, categoryId, categories, note, date, editing]);

  // ── Colors ────────────────────────────────────────────────────
  const typeColor = type === 'income' ? Colors.income : Colors.primary;
  const typeGradient = type === 'income'
    ? [Colors.income, '#00E6A8']
    : ['#6C47FF', '#9B6BFF'];
  const catColor = selectedCat?.color || Colors.income;
  const catGradient = [catColor, catColor + 'BB'];

  const isIncome = type === 'income';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Split Header ── */}
      <View style={s.headerRow}>
        {/* Left: Type toggle */}
        <TouchableOpacity
          style={s.headerPanelLeft}
          onPress={() => setType(t => t === 'income' ? 'expense' : 'income')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={typeGradient} style={s.headerGrad}>
            <View style={s.headerBack}>
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
            <Text style={s.headerSub}>Тип операции</Text>
            <Text style={s.headerMain}>{isIncome ? 'Доход' : 'Расход'}</Text>
            <View style={s.headerHint}>
              <Ionicons name="swap-horizontal" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={s.headerHintTxt}>нажмите чтобы сменить</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Right: Category */}
        <TouchableOpacity
          style={s.headerPanelRight}
          onPress={() => setShowCatPicker(true)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={catGradient} style={s.headerGrad}>
            <Text style={s.headerSub}>Категория</Text>
            <Text style={s.headerMain} numberOfLines={1}>
              {selectedCat?.name || 'Выбрать'}
            </Text>
            <View style={s.headerHint}>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={s.headerHintTxt}>нажмите чтобы выбрать</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Amount Display ── */}
      <View style={s.amountArea}>
        <Text style={[s.amountTypeLabel, { color: typeColor }]}>
          {isIncome ? 'Доход' : 'Расход'}
          {pendingOp ? <Text style={s.opLabel}>  {pendingOp}  {prevValue}</Text> : null}
        </Text>
        <View style={s.amountRow}>
          <Text style={[s.amountDisplay, display.length > 8 && { fontSize: 36 }]} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
          <Text style={[s.amountCurrency, { color: typeColor }]}>{currency.symbol}</Text>
        </View>
      </View>

      {/* ── Note ── */}
      <View style={s.noteWrap}>
        <TextInput
          style={s.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Заметки..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
        />
      </View>

      {/* ── Numpad ── */}
      <View style={s.numpad}>
        {/* Row 1 */}
        <View style={s.row}>
          <NumKey label="÷" onPress={() => pressOperator('÷')} isOp active={pendingOp === '÷'} />
          <NumKey label="7" onPress={() => pressDigit('7')} />
          <NumKey label="8" onPress={() => pressDigit('8')} />
          <NumKey label="9" onPress={() => pressDigit('9')} />
          <NumKey label="back" onPress={pressBackspace} onLongPress={() => { setDisplay('0'); setPrevValue(null); setPendingOp(null); }} isSpecial />
        </View>

        {/* Row 2 */}
        <View style={s.row}>
          <NumKey label="×" onPress={() => pressOperator('×')} isOp active={pendingOp === '×'} />
          <NumKey label="4" onPress={() => pressDigit('4')} />
          <NumKey label="5" onPress={() => pressDigit('5')} />
          <NumKey label="6" onPress={() => pressDigit('6')} />
          <NumKey label="cal" onPress={pressCycleDate} isSpecial />
        </View>

        {/* Rows 3-4 combined (confirm spans both) */}
        <View style={s.rowGroup}>
          <View style={s.leftCols}>
            {/* Row 3 */}
            <View style={s.row}>
              <NumKey label="−" onPress={() => pressOperator('−')} isOp active={pendingOp === '−'} />
              <NumKey label="1" onPress={() => pressDigit('1')} />
              <NumKey label="2" onPress={() => pressDigit('2')} />
              <NumKey label="3" onPress={() => pressDigit('3')} />
            </View>
            {/* Row 4 */}
            <View style={s.row}>
              <NumKey label="+" onPress={() => pressOperator('+')} isOp active={pendingOp === '+'} />
              <NumKey label="₴" onPress={() => {}} isSpecial />
              <NumKey label="0" onPress={() => pressDigit('0')} />
              <NumKey label="," onPress={pressDecimal} />
            </View>
          </View>
          {/* Confirm — tall button */}
          <TouchableOpacity style={s.confirmBtn} onPress={pressConfirm} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.income, '#00E6A8']} style={s.confirmGrad}>
              <Ionicons name="checkmark" size={34} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Date ── */}
      <View style={s.dateBar}>
        <Text style={s.dateTxt}>{formatDateDisplay(date)}</Text>
      </View>

      {/* ── Category Picker Modal ── */}
      <Modal visible={showCatPicker} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Категория</Text>
              <TouchableOpacity onPress={() => setShowCatPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              keyExtractor={item => String(item.id)}
              numColumns={3}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              renderItem={({ item }) => {
                const active = item.id === categoryId;
                return (
                  <TouchableOpacity
                    style={[s.catItem, active && { borderColor: item.color, backgroundColor: item.color + '15' }]}
                    onPress={() => { setCategoryId(item.id); setShowCatPicker(false); }}
                  >
                    <View style={[s.catIconWrap, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <Text style={[s.catName, active && { color: item.color }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={item.color} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NumKey({ label, onPress, onLongPress, isOp, isSpecial, active }) {
  const isBack = label === 'back';
  const isCal = label === 'cal';
  const isCurr = label === '₴';

  return (
    <TouchableOpacity
      style={[s.key, isOp && s.keyOp, active && s.keyOpActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.6}
    >
      {isBack
        ? <Ionicons name="backspace-outline" size={22} color={Colors.textSecondary} />
        : isCal
        ? <Ionicons name="calendar-outline" size={22} color={Colors.textSecondary} />
        : <Text style={[s.keyTxt, isOp && s.keyOpTxt, active && s.keyOpActiveTxt, isCurr && s.keyOpTxt]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}

const KEY_H = 64;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  headerRow: { flexDirection: 'row', height: 140 },
  headerPanelLeft: { flex: 1 },
  headerPanelRight: { flex: 1 },
  headerGrad: { flex: 1, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 14, justifyContent: 'flex-end' },
  headerBack: { position: 'absolute', top: 44, left: 14 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  headerMain: { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  headerHintTxt: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },

  // Amount
  amountArea: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  amountTypeLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  opLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '400' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amountDisplay: { fontSize: 52, fontWeight: '800', color: Colors.text, letterSpacing: -2, flex: 1 },
  amountCurrency: { fontSize: 26, fontWeight: '700' },

  // Note
  noteWrap: { marginHorizontal: 16, marginVertical: 8 },
  noteInput: { backgroundColor: Colors.bgCard, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },

  // Numpad
  numpad: { flex: 1, paddingTop: 4 },
  row: { flexDirection: 'row', flex: 1 },
  rowGroup: { flexDirection: 'row', flex: 2 },
  leftCols: { flex: 4, flexDirection: 'column' },

  key: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard, margin: 3, borderRadius: 14 },
  keyOp: { backgroundColor: Colors.bgMuted },
  keyOpActive: { backgroundColor: Colors.primaryLight },
  keyTxt: { fontSize: 22, fontWeight: '500', color: Colors.text },
  keyOpTxt: { fontSize: 22, fontWeight: '600', color: Colors.primary },
  keyOpActiveTxt: { color: Colors.primary },

  confirmBtn: { flex: 1, margin: 3, borderRadius: 14, overflow: 'hidden' },
  confirmGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Date
  dateBar: { paddingVertical: 10, alignItems: 'center' },
  dateTxt: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  // Category modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.65 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  catItem: { flex: 1, margin: 5, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  catIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
});
