import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Dimensions, PanResponder, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getRangeBalance, getTransactions, getCategoryStats, getCategories,
} from '../database/db';
import { formatShortDate, MONTH_NAMES_FULL } from '../utils/format';
import { Colors } from '../theme/colors';
import DonutChart from '../components/DonutChart';
import CalendarModal from '../components/CalendarModal';
import { useCurrency } from '../context/CurrencyContext';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_PAD = 12;
const AVAIL_W  = SCREEN_W - SIDE_PAD * 2;

const CHIP_SIDE_W = Math.floor(AVAIL_W * 0.21);
const CHIP_TOP_W  = Math.floor(AVAIL_W / 4);
const DONUT_SIZE  = AVAIL_W - CHIP_SIDE_W * 2 - 8;
const DONUT_SIZE_FULL = Math.min(AVAIL_W * 0.7, 240);

// ─── Period helpers ───────────────────────────────────────────

function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function getDateRange(periodType, anchor, customFrom, customTo) {
  if (periodType === 'all')   return { dateFrom: null, dateTo: null };
  if (periodType === 'range') return { dateFrom: customFrom, dateTo: customTo };
  const d = new Date(anchor + 'T00:00:00');
  if (periodType === 'today' || periodType === 'day') return { dateFrom: anchor, dateTo: anchor };
  if (periodType === 'week') {
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { dateFrom: iso(mon), dateTo: iso(addDays(mon, 6)) };
  }
  if (periodType === 'month') {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return { dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-31` };
  }
  if (periodType === 'year') {
    return { dateFrom: `${d.getFullYear()}-01-01`, dateTo: `${d.getFullYear()}-12-31` };
  }
  return { dateFrom: null, dateTo: null };
}

function shiftAnchor(anchor, periodType, dir) {
  const d = new Date(anchor + 'T00:00:00');
  if (periodType === 'day' || periodType === 'today') d.setDate(d.getDate() + dir);
  else if (periodType === 'week')  d.setDate(d.getDate() + dir * 7);
  else if (periodType === 'month') d.setMonth(d.getMonth() + dir);
  else if (periodType === 'year')  d.setFullYear(d.getFullYear() + dir);
  return iso(d);
}

function getPeriodLabel(periodType, anchor, customFrom, customTo) {
  const d = new Date(anchor + 'T00:00:00');
  const sm = { day: 'numeric', month: 'short' };
  if (periodType === 'all')   return 'ВСЁ ВРЕМЯ';
  if (periodType === 'today') return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase();
  if (periodType === 'day')   return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase();
  if (periodType === 'week') {
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = addDays(mon, 6);
    return `${mon.toLocaleDateString('ru-RU', sm)} – ${sun.toLocaleDateString('ru-RU', sm)}`.toUpperCase();
  }
  if (periodType === 'month') {
    return `${(MONTH_NAMES_FULL[d.getMonth()] || '').toUpperCase()} ${d.getFullYear()}`;
  }
  if (periodType === 'year')  return String(d.getFullYear());
  if (periodType === 'range' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00');
    const t = new Date(customTo   + 'T00:00:00');
    if (customFrom === customTo) return f.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase();
    return `${f.toLocaleDateString('ru-RU', sm)} – ${t.toLocaleDateString('ru-RU', sm)}`.toUpperCase();
  }
  return '';
}

function getPeriodBadge(periodType, anchor) {
  const d = new Date(anchor + 'T00:00:00');
  if (periodType === 'all')   return '∞';
  if (periodType === 'today') return d.getDate();
  if (periodType === 'day')   return d.getDate();
  if (periodType === 'week')  return '7';
  if (periodType === 'month') return daysInMonth(d.getFullYear(), d.getMonth() + 1);
  if (periodType === 'year')  return '365';
  if (periodType === 'range') return '↔';
  return '?';
}

const NAVIGABLE = new Set(['day', 'today', 'week', 'month', 'year']);

// ─── Main component ───────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { currency, fmt, fmtC } = useCurrency();
  const now = new Date();
  const todayIso = iso(now);

  const [periodType,  setPeriodType]  = useState('month');
  const [anchorDate,  setAnchorDate]  = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customFrom,  setCustomFrom]  = useState(todayIso);
  const [customTo,    setCustomTo]    = useState(todayIso);
  const [showSheet,   setShowSheet]   = useState(false);
  const [showCal,     setShowCal]     = useState(false);
  const [calMode,     setCalMode]     = useState('range'); // 'single' | 'range'

  const [monthly, setMonthly]   = useState({ income: 0, expense: 0, balance: 0 });
  const [recent, setRecent]     = useState([]);
  const [allCats, setAllCats]   = useState({ income: [], expense: [] });
  const [chartTab, setChartTab] = useState('expense');
  const [refreshing, setRefreshing] = useState(false);

  const { dateFrom, dateTo } = getDateRange(periodType, anchorDate, customFrom, customTo);

  const load = useCallback(async () => {
    const cur = currency.code;
    const [m, t, allInc, allExp, si, se] = await Promise.all([
      getRangeBalance(dateFrom, dateTo, cur),
      getTransactions({ limit: 8, currency: cur }),
      getCategories('income'),
      getCategories('expense'),
      getCategoryStats({ type: 'income',  dateFrom, dateTo, currency: cur }),
      getCategoryStats({ type: 'expense', dateFrom, dateTo, currency: cur }),
    ]);
    setMonthly(m);
    setRecent(t);
    setAllCats({
      income:  allInc.map(cat => {
        const stat = si.find(s => s.id === cat.id);
        return { id: cat.id, name: cat.name, value: stat?.total || 0, color: cat.color, icon: cat.icon };
      }),
      expense: allExp.map(cat => {
        const stat = se.find(s => s.id === cat.id);
        return { id: cat.id, name: cat.name, value: stat?.total || 0, color: cat.color, icon: cat.icon };
      }),
    });
  }, [currency.code, dateFrom, dateTo]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const canNavigate = NAVIGABLE.has(periodType);
  const prevPeriod = () => setAnchorDate(a => shiftAnchor(a, periodType, -1));
  const nextPeriod = () => setAnchorDate(a => shiftAnchor(a, periodType, 1));

  const selectPeriod = (type) => {
    setShowSheet(false);
    if (type === 'day') {
      setCalMode('single');
      setShowCal(true);
      return;
    }
    if (type === 'range') {
      setCalMode('range');
      setShowCal(true);
      setPeriodType('range');
      return;
    }
    if (type === 'today') {
      setPeriodType('today');
      setAnchorDate(todayIso);
      return;
    }
    setPeriodType(type);
    if (type === 'month') setAnchorDate(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    else if (type === 'week' || type === 'year') setAnchorDate(todayIso);
  };

  const savingsRate = monthly.income > 0
    ? Math.round((monthly.balance / monthly.income) * 100)
    : 0;

  const cats = allCats[chartTab];
  const sortedCats = [...cats].sort((a, b) => b.value - a.value);
  const donutData = sortedCats.filter(c => c.value > 0);

  const hasSideCats = allCats.income.length > 4 || allCats.expense.length > 4;
  const topCats    = sortedCats.slice(0, 4);
  const leftCats   = sortedCats.slice(4, 6);
  const rightCats  = sortedCats.slice(6, 8);
  const bottomCats = sortedCats.slice(8, 12);

  const openAdd = (cat) => {
    navigation.navigate('AddTransaction', { initialType: chartTab, initialCategoryId: cat.id });
  };

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        canNavigate && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12,
      onPanResponderRelease: (_, { dx }) => {
        if (!canNavigate) return;
        if (dx > 50) prevPeriod();
        else if (dx < -50) nextPeriod();
      },
    })
  ).current;

  const periodLabel = getPeriodLabel(periodType, anchorDate, customFrom, customTo);
  const periodBadge = getPeriodBadge(periodType, anchorDate);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={['#6C47FF', '#9B6BFF', '#C084FC']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <View style={s.heroLabelRow}>
                <Text style={s.heroLabel}>{periodLabel}</Text>
                <View style={s.currencyBadge}>
                  <Text style={s.currencyBadgeTxt}>{currency.flag} {currency.code}</Text>
                </View>
              </View>
              <Text style={s.heroBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {fmt(monthly.balance)}
              </Text>
              <Text style={s.heroSub}>Баланс за период</Text>
            </View>
            <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person-circle-outline" size={26} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>

          <View style={s.heroStats}>
            <HeroStat icon="arrow-up"    iconBg="rgba(0,196,140,0.25)"  iconColor="#00E6A8" label="Доходы"    value={monthly.income} />
            <View style={s.heroDivider} />
            <HeroStat icon="arrow-down"  iconBg="rgba(255,90,95,0.25)"  iconColor="#FF8A8E" label="Расходы"   value={monthly.expense} />
            <View style={s.heroDivider} />
            <HeroStat icon="trending-up" iconBg="rgba(255,255,255,0.2)" iconColor="#fff"    label="Накоплено" value={null} text={`${savingsRate}%`} />
          </View>
        </LinearGradient>

        {/* ── Category section with swipe ── */}
        <View {...swipePan.panHandlers}>
          {/* Period selector bar */}
          <View style={s.monthRow}>
            {canNavigate ? (
              <TouchableOpacity style={s.monthArrow} onPress={prevPeriod} activeOpacity={0.7}>
                <Text style={s.monthArrowTxt}>{'«'}</Text>
              </TouchableOpacity>
            ) : <View style={s.monthArrow} />}

            <TouchableOpacity style={s.monthPill} onPress={() => setShowSheet(true)} activeOpacity={0.8}>
              <View style={s.monthDayBox}>
                <Text style={s.monthDayTxt}>{periodBadge}</Text>
              </View>
              <Text style={s.monthPillTxt}>{periodLabel}</Text>
              <Ionicons name="chevron-down" size={13} color={Colors.expense} />
            </TouchableOpacity>

            {canNavigate ? (
              <TouchableOpacity style={s.monthArrow} onPress={nextPeriod} activeOpacity={0.7}>
                <Text style={s.monthArrowTxt}>{'»'}</Text>
              </TouchableOpacity>
            ) : <View style={s.monthArrow} />}
          </View>

          {/* Radial layout */}
          <View style={s.section}>
            {topCats.length > 0 && (
              <View style={s.chipRow}>
                {topCats.map(cat => (
                  <CatChip key={cat.id} cat={cat} width={CHIP_TOP_W} onPress={() => openAdd(cat)} />
                ))}
              </View>
            )}

            <View style={s.middleRow}>
              {hasSideCats && (
                <View style={[s.sideCol, { width: CHIP_SIDE_W }]}>
                  {leftCats.map(cat => (
                    <CatChip key={cat.id} cat={cat} width={CHIP_SIDE_W} onPress={() => openAdd(cat)} />
                  ))}
                </View>
              )}
              <View style={[s.donutWrap, { width: hasSideCats ? DONUT_SIZE : DONUT_SIZE_FULL }]}>
                <DonutChart
                  data={donutData}
                  size={hasSideCats ? DONUT_SIZE - 8 : DONUT_SIZE_FULL - 8}
                  label={chartTab === 'expense' ? 'РАСХОДЫ' : 'ДОХОДЫ'}
                  mainAmount={fmtC(chartTab === 'expense' ? monthly.expense : monthly.income)}
                  mainColor={chartTab === 'expense' ? Colors.expense : Colors.income}
                  secondaryAmount={fmtC(chartTab === 'expense' ? monthly.income : monthly.expense)}
                  secondaryColor={chartTab === 'expense' ? Colors.income : Colors.expense}
                  onPress={() => setChartTab(t => t === 'expense' ? 'income' : 'expense')}
                />
              </View>
              {hasSideCats && (
                <View style={[s.sideCol, { width: CHIP_SIDE_W }]}>
                  {rightCats.map(cat => (
                    <CatChip key={cat.id} cat={cat} width={CHIP_SIDE_W} onPress={() => openAdd(cat)} />
                  ))}
                </View>
              )}
            </View>

            {bottomCats.length > 0 && (
              <View style={s.chipRow}>
                {bottomCats.map(cat => (
                  <CatChip key={cat.id} cat={cat} width={CHIP_TOP_W} onPress={() => openAdd(cat)} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Recent Transactions ── */}
        <View style={[s.section, { marginBottom: 100 }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Последние операции</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={s.seeAll}>Все →</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={s.emptyTitle}>Нет операций</Text>
              <Text style={s.emptyText}>Нажмите + чтобы добавить</Text>
            </View>
          ) : (
            <View style={s.txCard}>
              {recent.map((t, i) => (
                <TxRow key={t.id} item={t} last={i === recent.length - 1} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Period Picker Bottom Sheet ── */}
      <Modal visible={showSheet} transparent animationType="slide">
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setShowSheet(false)} />
          <PeriodSheet
            periodType={periodType}
            anchorDate={anchorDate}
            customFrom={customFrom}
            customTo={customTo}
            onSelect={selectPeriod}
            onClose={() => setShowSheet(false)}
          />
        </View>
      </Modal>

      {/* ── Calendar for day / range ── */}
      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        mode={calMode === 'range' ? 'range' : 'range'}
        from={calMode === 'range' ? customFrom : anchorDate}
        to={calMode === 'range' ? customTo : anchorDate}
        onApply={(f, t) => {
          if (calMode === 'single') {
            setPeriodType('day');
            setAnchorDate(f);
          } else {
            setPeriodType('range');
            setCustomFrom(f);
            setCustomTo(t);
          }
          setShowCal(false);
        }}
      />
    </View>
  );
}

// ─── Period Sheet ─────────────────────────────────────────────

function PeriodSheet({ periodType, anchorDate, customFrom, customTo, onSelect, onClose }) {
  const now = new Date();
  const todayIso = iso(now);
  const d = new Date(anchorDate + 'T00:00:00');

  const weekMon = new Date(d);
  weekMon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weekSun = addDays(weekMon, 6);
  const sm = { day: 'numeric', month: 'short' };

  const weekLabel = `${weekMon.toLocaleDateString('ru-RU', sm)} – ${weekSun.toLocaleDateString('ru-RU', sm)}`;
  const todayLabel = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const monthLabel = `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
  const yearLabel  = `${d.getFullYear()} год`;
  const rangeLabel = customFrom && customTo
    ? customFrom === customTo
      ? new Date(customFrom + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : `${new Date(customFrom + 'T00:00:00').toLocaleDateString('ru-RU', sm)} – ${new Date(customTo + 'T00:00:00').toLocaleDateString('ru-RU', sm)}`
    : monthLabel;

  const isActive = (type) => periodType === type;

  return (
    <View style={ps.sheet}>
      <View style={ps.handle} />
      <View style={ps.header}>
        <Text style={ps.title}>Период</Text>
        <TouchableOpacity onPress={onClose} style={ps.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Range row — full width */}
      <TouchableOpacity
        style={[ps.optionWide, isActive('range') && ps.optionActive]}
        onPress={() => onSelect('range')}
        activeOpacity={0.75}
      >
        <View style={[ps.iconBox, isActive('range') && ps.iconBoxActive]}>
          <Ionicons name="ellipsis-horizontal" size={18} color={isActive('range') ? '#fff' : Colors.text} />
        </View>
        <View>
          <Text style={[ps.optLabel, isActive('range') && ps.optLabelActive]}>Выбрать диапазон</Text>
          <Text style={[ps.optSub, isActive('range') && ps.optSubActive]}>{rangeLabel}</Text>
        </View>
      </TouchableOpacity>

      {/* 2×2 grid */}
      <View style={ps.grid}>
        <PeriodOption badge="∞"    label="Все время" sub=""            type="all"   active={isActive('all')}   onPress={onSelect} />
        <PeriodOption icon="calendar" label="Выбрать день" sub={todayLabel} type="day" active={isActive('day')} onPress={onSelect} />
        <PeriodOption badge="7"    label="Неделя"    sub={weekLabel}   type="week"  active={isActive('week')}  onPress={onSelect} />
        <PeriodOption badge="1"    label="Сегодня"   sub={todayLabel}  type="today" active={isActive('today')} onPress={onSelect} />
        <PeriodOption badge="365"  label="Год"       sub={yearLabel}   type="year"  active={isActive('year')}  onPress={onSelect} />
        <PeriodOption badge={String(daysInMonth(d.getFullYear(), d.getMonth() + 1))} label="Месяц" sub={monthLabel} type="month" active={isActive('month')} onPress={onSelect} />
      </View>
    </View>
  );
}

function PeriodOption({ badge, icon, label, sub, type, active, onPress }) {
  return (
    <TouchableOpacity
      style={[ps.option, active && ps.optionActive]}
      onPress={() => onPress(type)}
      activeOpacity={0.75}
    >
      <View style={[ps.iconBox, active && ps.iconBoxActive]}>
        {icon
          ? <Ionicons name={icon} size={16} color={active ? '#fff' : Colors.text} />
          : <Text style={[ps.badgeTxt, active && { color: '#fff' }]}>{badge}</Text>
        }
      </View>
      <Text style={[ps.optLabel, active && ps.optLabelActive]}>{label}</Text>
      {sub ? <Text style={[ps.optSub, active && ps.optSubActive]} numberOfLines={1}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function CatChip({ cat, width, onPress }) {
  const { fmtC, currency } = useCurrency();
  const hasAmt = cat.value > 0;
  const iconSize = width < 85 ? 20 : 22;
  const circleSize = width < 85 ? 44 : 50;
  return (
    <TouchableOpacity style={[s.chip, { width }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.chipName} numberOfLines={1}>{cat.name}</Text>
      <View style={[s.chipCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: cat.color + '22' }]}>
        <Ionicons name={cat.icon || 'ellipse'} size={iconSize} color={cat.color} />
      </View>
      <Text style={[s.chipAmt, { color: hasAmt ? cat.color : Colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {hasAmt ? fmtC(cat.value) : `0 ${currency.symbol}`}
      </Text>
    </TouchableOpacity>
  );
}

function HeroStat({ icon, iconBg, iconColor, label, value, text }) {
  const { fmtC } = useCurrency();
  return (
    <View style={s.heroStat}>
      <View style={[s.heroStatIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroStatLabel}>{label}</Text>
        <Text style={s.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {text ?? fmtC(value)}
        </Text>
      </View>
    </View>
  );
}

function TxRow({ item, last }) {
  const { fmtC } = useCurrency();
  const isIncome = item.type === 'income';
  return (
    <View style={[s.txRow, last && { borderBottomWidth: 0 }]}>
      <View style={[s.txIcon, { backgroundColor: (item.category_color || Colors.primary) + '18' }]}>
        <Ionicons name={item.category_icon || 'ellipse'} size={20} color={item.category_color || Colors.primary} />
      </View>
      <View style={s.txBody}>
        <Text style={s.txCat}>{item.category_name || 'Без категории'}</Text>
        {item.note ? <Text style={s.txNote} numberOfLines={1}>{item.note}</Text> : null}
      </View>
      <View style={s.txRight}>
        <Text style={[s.txAmount, { color: isIncome ? Colors.income : Colors.expense }]}>
          {isIncome ? '+' : '−'}{fmtC(item.amount)}
        </Text>
        <Text style={s.txDate}>{formatShortDate(item.date)}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  currencyBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currencyBadgeTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },
  heroBalance: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  profileBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18, padding: 14,
  },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  heroStatIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  heroStatValue: { fontSize: 13, color: '#fff', fontWeight: '700' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.bg,
  },
  monthArrow: { padding: 10 },
  monthArrowTxt: { fontSize: 22, fontWeight: '800', color: Colors.expense },
  monthPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.expenseLight, borderRadius: 28,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 8, gap: 8,
  },
  monthDayBox: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.expense,
    alignItems: 'center', justifyContent: 'center',
  },
  monthDayTxt: { fontSize: 12, fontWeight: '800', color: Colors.expense },
  monthPillTxt: { fontSize: 13, fontWeight: '800', color: Colors.expense, letterSpacing: 0.3, flexShrink: 1 },

  section: { marginHorizontal: SIDE_PAD, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  chipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  middleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 4, gap: 4 },
  sideCol: { gap: 4, justifyContent: 'center' },
  donutWrap: { alignItems: 'center', justifyContent: 'center' },

  chip: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  chipName: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', width: '100%' },
  chipCircle: { alignItems: 'center', justifyContent: 'center' },
  chipAmt: { fontSize: 11, fontWeight: '700', textAlign: 'center', width: '100%' },

  txCard: {
    backgroundColor: Colors.bgCard, borderRadius: 20, overflow: 'hidden',
    elevation: 3, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12,
  },
  txIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txBody: { flex: 1 },
  txCat: { fontSize: 14, fontWeight: '600', color: Colors.text },
  txNote: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
});

const ps = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },

  // Wide range option
  optionWide: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgInput, borderRadius: 18,
    padding: 16, marginBottom: 10,
  },

  // 2×3 grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  option: {
    width: (SCREEN_W - 32 - 10) / 2,
    backgroundColor: Colors.bgInput, borderRadius: 18,
    padding: 16, gap: 4,
  },

  optionActive: { backgroundColor: Colors.text },

  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  iconBoxActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },

  badgeTxt: { fontSize: 13, fontWeight: '800', color: Colors.text },

  optLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  optLabelActive: { color: '#fff' },
  optSub: { fontSize: 11, color: Colors.textMuted },
  optSubActive: { color: 'rgba(255,255,255,0.65)' },
});
