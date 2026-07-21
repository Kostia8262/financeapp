import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Modal, PanResponder, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getRangeBalance, getTransactions, getCategoryStats, getCategories,
} from '../database/db';
import { formatShortDate } from '../utils/format';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Radius } from '../theme/radius';
import { Typography } from '../theme/typography';
import DonutChart from '../components/DonutChart';
import CalendarModal from '../components/CalendarModal';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import Card from '../components/ui/Card';
import GradientHero from '../components/ui/GradientHero';
import HeroStat from '../components/ui/HeroStat';
import EmptyState from '../components/ui/EmptyState';
import PeriodPill from '../components/ui/PeriodPill';

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

function getPeriodLabel(periodType, anchor, customFrom, customTo, months, locale, allTimeLabel) {
  if (periodType === 'all') return allTimeLabel;
  const d = new Date(anchor + 'T00:00:00');
  const sm = { day: 'numeric', month: 'short' };
  if (periodType === 'today') return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }).toUpperCase();
  if (periodType === 'day')   return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }).toUpperCase();
  if (periodType === 'week') {
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = addDays(mon, 6);
    return `${mon.toLocaleDateString(locale, sm)} – ${sun.toLocaleDateString(locale, sm)}`.toUpperCase();
  }
  if (periodType === 'month') {
    return `${(months[d.getMonth()] || '').toUpperCase()} ${d.getFullYear()}`;
  }
  if (periodType === 'year') return String(d.getFullYear());
  if (periodType === 'range' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00');
    const t = new Date(customTo   + 'T00:00:00');
    if (customFrom === customTo) return f.toLocaleDateString(locale, { day: 'numeric', month: 'long' }).toUpperCase();
    return `${f.toLocaleDateString(locale, sm)} – ${t.toLocaleDateString(locale, sm)}`.toUpperCase();
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

// ─── Skeleton ─────────────────────────────────────────────────

function Skeleton({ width, height, radius = 10, style }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3,  duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[{ backgroundColor: Colors.border, borderRadius: radius, opacity: pulse }, style, { width, height }]}
    />
  );
}

// ─── Main component ───────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { currency, fmt, fmtC } = useCurrency();
  const { t } = useLanguage();
  const now = new Date();
  const todayIso = iso(now);

  const [periodType,  setPeriodType]  = useState('month');
  const [anchorDate,  setAnchorDate]  = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customFrom,  setCustomFrom]  = useState(todayIso);
  const [customTo,    setCustomTo]    = useState(todayIso);
  const [showSheet,   setShowSheet]   = useState(false);
  const [showCal,     setShowCal]     = useState(false);
  const [calMode,     setCalMode]     = useState('range');
  const [monthly,     setMonthly]     = useState({ income: 0, expense: 0, balance: 0 });
  const [recent,      setRecent]      = useState([]);
  const [allCats,     setAllCats]     = useState({ income: [], expense: [] });
  const [chartTab,    setChartTab]    = useState('expense');
  const [refreshing,  setRefreshing]  = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // ─── Animation refs ───────────────────────────────────────
  const slideX       = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const periodTypeRef = useRef('month');
  const canNavigateRef = useRef(true);

  useEffect(() => {
    periodTypeRef.current = periodType;
    canNavigateRef.current = NAVIGABLE.has(periodType);
  }, [periodType]);

  // ─── Data ─────────────────────────────────────────────────
  const { dateFrom, dateTo } = getDateRange(periodType, anchorDate, customFrom, customTo);

  const load = useCallback(async () => {
    try {
      const cur = currency.code;
      const [m, tx, allInc, allExp, si, se] = await Promise.all([
        getRangeBalance(dateFrom, dateTo, cur),
        getTransactions({ limit: 8, currency: cur }),
        getCategories('income'),
        getCategories('expense'),
        getCategoryStats({ type: 'income',  dateFrom, dateTo, currency: cur }),
        getCategoryStats({ type: 'expense', dateFrom, dateTo, currency: cur }),
      ]);
      setMonthly(m);
      setRecent(tx);
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (e) {
      Alert.alert(t('error'), t('load_error_msg'));
    } finally {
      setIsFirstLoad(false);
    }
  }, [currency.code, dateFrom, dateTo]);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(isFirstLoad ? 0 : 0.6);
    load();
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    fadeAnim.setValue(0.5);
    await load();
    setRefreshing(false);
  };

  // ─── Navigation ───────────────────────────────────────────
  const canNavigate = NAVIGABLE.has(periodType);
  const prevPeriod = () => setAnchorDate(a => shiftAnchor(a, periodTypeRef.current, -1));
  const nextPeriod = () => setAnchorDate(a => shiftAnchor(a, periodTypeRef.current, 1));

  const selectPeriod = (type) => {
    setShowSheet(false);
    fadeAnim.setValue(0.5);
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

  // ─── Swipe pan responder ──────────────────────────────────
  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        canNavigateRef.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
      onPanResponderMove: (_, { dx }) => {
        slideX.setValue(dx * 0.38);
      },
      onPanResponderRelease: (_, { dx }) => {
        if (!canNavigateRef.current || Math.abs(dx) < 50) {
          Animated.spring(slideX, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }).start();
          return;
        }
        const dir = dx > 0 ? 1 : -1;
        const pt  = periodTypeRef.current;
        Animated.timing(slideX, {
          toValue: dir * SCREEN_W, duration: 200, useNativeDriver: true,
        }).start(() => {
          if (dir > 0) setAnchorDate(a => shiftAnchor(a, pt, -1));
          else         setAnchorDate(a => shiftAnchor(a, pt, 1));
          slideX.setValue(-dir * SCREEN_W * 0.5);
          Animated.spring(slideX, {
            toValue: 0, tension: 65, friction: 9, useNativeDriver: true,
          }).start();
        });
      },
    })
  ).current;

  // ─── Derived state ────────────────────────────────────────
  const savingsRate = monthly.income > 0
    ? Math.round((monthly.balance / monthly.income) * 100)
    : 0;

  const cats = allCats[chartTab];
  const sortedCats  = [...cats].sort((a, b) => b.value - a.value);
  const donutData   = sortedCats.filter(c => c.value > 0);
  const hasSideCats = allCats.income.length > 4 || allCats.expense.length > 4;
  const topCats     = sortedCats.slice(0, 4);
  const leftCats    = sortedCats.slice(4, 6);
  const rightCats   = sortedCats.slice(6, 8);
  const bottomCats  = sortedCats.slice(8, 12);

  const openAdd = (cat) => {
    router.push({ pathname: '/add-transaction', params: { initialType: chartTab, initialCategoryId: cat.id } });
  };

  const locale = t('locale');
  const months = t('months');
  const periodLabel = getPeriodLabel(periodType, anchorDate, customFrom, customTo, months, locale, t('all_time').toUpperCase());
  const periodBadge = getPeriodBadge(periodType, anchorDate);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Hero ── */}
        <GradientHero>
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
              <Text style={s.heroSub}>{t('period_balance')}</Text>
            </View>
            <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/profile')}>
              <Ionicons name="person-circle-outline" size={26} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>

          <View style={s.heroStats}>
            <HeroStat icon="arrow-up"    iconBg={Colors.income + '40'}  iconColor="#00E6A8" label={t('income')}   value={fmtC(monthly.income)} />
            <View style={s.heroDivider} />
            <HeroStat icon="arrow-down"  iconBg={Colors.expense + '40'}  iconColor="#FF8A8E" label={t('expense')}  value={fmtC(monthly.expense)} />
            <View style={s.heroDivider} />
            <HeroStat icon="trending-up" iconBg="rgba(255,255,255,0.2)" iconColor={Colors.white}    label={t('surplus')}  value={`${savingsRate}%`} />
          </View>
        </GradientHero>

        {/* ── Swipeable category section ── */}
        <Animated.View
          {...swipePan.panHandlers}
          style={{ transform: [{ translateX: slideX }] }}
        >
          {/* Period selector bar */}
          <PeriodPill
            canNavigate={canNavigate}
            badge={periodBadge}
            label={periodLabel}
            onPrev={prevPeriod}
            onNext={nextPeriod}
            onPress={() => setShowSheet(true)}
          />

          {/* Radial layout — skeleton on first load */}
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            {isFirstLoad ? (
              <View>
                <View style={s.chipRow}>
                  {[0,1,2,3].map(i => <Skeleton key={i} width={CHIP_TOP_W - 4} height={74} radius={14} style={{ margin: 2 }} />)}
                </View>
                <View style={s.middleRow}>
                  <Skeleton width={DONUT_SIZE_FULL} height={DONUT_SIZE_FULL} radius={DONUT_SIZE_FULL / 2} />
                </View>
              </View>
            ) : (
              <>
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
                      label={chartTab === 'expense' ? t('expense').toUpperCase() : t('income').toUpperCase()}
                      mainAmount={fmtC(chartTab === 'expense' ? monthly.expense : monthly.income)}
                      mainColor={chartTab === 'expense' ? Colors.expense : Colors.income}
                      secondaryAmount={fmtC(chartTab === 'expense' ? monthly.income : monthly.expense)}
                      secondaryColor={chartTab === 'expense' ? Colors.income : Colors.expense}
                      onPress={() => setChartTab(prev => prev === 'expense' ? 'income' : 'expense')}
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
              </>
            )}
          </Animated.View>
        </Animated.View>

        {/* ── Recent Transactions ── */}
        <View style={[s.section, { marginBottom: 100 }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('recent_ops')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={s.seeAll}>{t('see_all')}</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <EmptyState icon="receipt-outline" title={t('no_ops')} subtitle={t('tap_to_add')} />
          ) : (
            <Card>
              {recent.map((tx, i) => (
                <TxRow key={tx.id} item={tx} last={i === recent.length - 1} noCategory={t('no_category')} locale={locale} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* ── Period Picker Bottom Sheet ── */}
      <Modal visible={showSheet} transparent animationType="fade">
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setShowSheet(false)} />
          <Animated.View style={{ transform: [{ translateY: showSheet ? 0 : 300 }] }}>
            <PeriodSheet
              periodType={periodType}
              anchorDate={anchorDate}
              customFrom={customFrom}
              customTo={customTo}
              onSelect={selectPeriod}
              onClose={() => setShowSheet(false)}
              t={t}
              locale={locale}
              months={months}
            />
          </Animated.View>
        </View>
      </Modal>

      {/* ── Calendar for day / range ── */}
      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        mode={calMode === 'range' ? 'range' : 'range'}
        from={calMode === 'range' ? customFrom : anchorDate}
        to={calMode === 'range' ? customTo : anchorDate}
        onApply={(f, tv) => {
          if (calMode === 'single') {
            setPeriodType('day');
            setAnchorDate(f);
          } else {
            setPeriodType('range');
            setCustomFrom(f);
            setCustomTo(tv);
          }
          setShowCal(false);
        }}
      />
    </View>
  );
}

// ─── Period Sheet ─────────────────────────────────────────────

function PeriodSheet({ periodType, anchorDate, customFrom, customTo, onSelect, onClose, t, locale, months }) {
  const now = new Date();
  const d = new Date(anchorDate + 'T00:00:00');

  const weekMon = new Date(d);
  weekMon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weekSun = addDays(weekMon, 6);
  const sm = { day: 'numeric', month: 'short' };

  const weekLabel  = `${weekMon.toLocaleDateString(locale, sm)} – ${weekSun.toLocaleDateString(locale, sm)}`;
  const todayLabel = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const monthLabel = `${months[d.getMonth()]} ${d.getFullYear()}`;
  const ys = t('year_suffix');
  const yearLabel  = ys ? `${d.getFullYear()} ${ys}` : `${d.getFullYear()}`;
  const rangeLabel = customFrom && customTo
    ? customFrom === customTo
      ? new Date(customFrom + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : `${new Date(customFrom + 'T00:00:00').toLocaleDateString(locale, sm)} – ${new Date(customTo + 'T00:00:00').toLocaleDateString(locale, sm)}`
    : monthLabel;

  const isActive = (type) => periodType === type;

  return (
    <View style={ps.sheet}>
      <View style={ps.handle} />
      <View style={ps.header}>
        <Text style={ps.title}>{t('period')}</Text>
        <TouchableOpacity onPress={onClose} style={ps.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[ps.optionWide, isActive('range') && ps.optionActive]}
        onPress={() => onSelect('range')}
        activeOpacity={0.75}
      >
        <View style={[ps.iconBox, isActive('range') && ps.iconBoxActive]}>
          <Ionicons name="ellipsis-horizontal" size={18} color={isActive('range') ? Colors.white : Colors.text} />
        </View>
        <View>
          <Text style={[ps.optLabel, isActive('range') && ps.optLabelActive]}>{t('choose_range')}</Text>
          <Text style={[ps.optSub, isActive('range') && ps.optSubActive]}>{rangeLabel}</Text>
        </View>
      </TouchableOpacity>

      <View style={ps.grid}>
        <PeriodOption badge="∞"      label={t('all_time')}   sub=""          type="all"   active={isActive('all')}   onPress={onSelect} />
        <PeriodOption icon="calendar" label={t('choose_day')} sub={todayLabel} type="day"  active={isActive('day')}   onPress={onSelect} />
        <PeriodOption badge="7"      label={t('week')}       sub={weekLabel}  type="week"  active={isActive('week')}  onPress={onSelect} />
        <PeriodOption badge="1"      label={t('today')}      sub={todayLabel} type="today" active={isActive('today')} onPress={onSelect} />
        <PeriodOption badge="365"    label={t('year')}       sub={yearLabel}  type="year"  active={isActive('year')}  onPress={onSelect} />
        <PeriodOption badge={String(daysInMonth(d.getFullYear(), d.getMonth() + 1))} label={t('month')} sub={monthLabel} type="month" active={isActive('month')} onPress={onSelect} />
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
          ? <Ionicons name={icon} size={16} color={active ? Colors.white : Colors.text} />
          : <Text style={[ps.badgeTxt, active && { color: Colors.white }]}>{badge}</Text>
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
  const iconSize   = width < 85 ? 20 : 22;
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

function TxRow({ item, last, noCategory, locale }) {
  const { fmtC } = useCurrency();
  const isIncome = item.type === 'income';
  return (
    <View style={[s.txRow, last && { borderBottomWidth: 0 }]}>
      <View style={[s.txIcon, { backgroundColor: (item.category_color || Colors.primary) + '18' }]}>
        <Ionicons name={item.category_icon || 'ellipse'} size={20} color={item.category_color || Colors.primary} />
      </View>
      <View style={s.txBody}>
        <Text style={s.txCat}>{item.category_name || noCategory}</Text>
        {item.note ? <Text style={s.txNote} numberOfLines={1}>{item.note}</Text> : null}
      </View>
      <View style={s.txRight}>
        <Text style={[s.txAmount, { color: isIncome ? Colors.income : Colors.expense }]}>
          {isIncome ? '+' : '−'}{fmtC(item.amount)}
        </Text>
        <Text style={s.txDate}>{formatShortDate(item.date, locale)}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xl, gap: Spacing.md },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  currencyBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  currencyBadgeTxt: { fontSize: 11, color: Colors.white, fontWeight: '700' },
  heroBalance: { ...Typography.heroBalance, color: Colors.white },
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
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },

  section: { marginHorizontal: SIDE_PAD, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  chipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  middleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 4, gap: 4 },
  sideCol: { gap: 4, justifyContent: 'center' },
  donutWrap: { alignItems: 'center', justifyContent: 'center' },

  chip: { alignItems: 'center', gap: 4, paddingVertical: Spacing.sm },
  chipName: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', width: '100%' },
  chipCircle: { alignItems: 'center', justifyContent: 'center' },
  chipAmt: { fontSize: 11, fontWeight: '700', textAlign: 'center', width: '100%' },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md,
  },
  txIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txBody: { flex: 1 },
  txCat: { fontSize: 14, fontWeight: '600', color: Colors.text },
  txNote: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
});

const ps = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, paddingTop: Spacing.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.title },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  optionWide: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgInput, borderRadius: 18,
    padding: 16, marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  iconBoxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  badgeTxt: { fontSize: 13, fontWeight: '800', color: Colors.text },
  optLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  optLabelActive: { color: Colors.white },
  optSub: { fontSize: 11, color: Colors.textMuted },
  optSubActive: { color: 'rgba(255,255,255,0.65)' },
});
