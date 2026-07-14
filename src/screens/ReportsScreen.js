import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  Dimensions, PanResponder, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryStats, getExtendedStats, getDailyDataBoth } from '../database/db';
import { Colors } from '../theme/colors';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { Radius } from '../theme/radius';
import { Typography } from '../theme/typography';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import CalendarModal from '../components/CalendarModal';
import Card from '../components/ui/Card';
import GradientHero from '../components/ui/GradientHero';
import HeroStat from '../components/ui/HeroStat';
import EmptyState from '../components/ui/EmptyState';

const { width: SCREEN_W } = Dimensions.get('window');

function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function rangeForPeriod(period, anchor) {
  const d = anchor ? new Date(anchor + 'T00:00:00') : new Date();
  d.setHours(0, 0, 0, 0);
  switch (period) {
    case 'day':   return { from: iso(d), to: iso(d) };
    case 'week': {
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return { from: iso(mon), to: iso(addDays(mon, 6)) };
    }
    case 'month':
      return {
        from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,
        to:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-31`,
      };
    case 'year':
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
    default:
      return { from: iso(d), to: iso(d) };
  }
}

function buildPeriodLabel(period, from, to, months, locale) {
  if (!from) return '';
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to   + 'T00:00:00');
  const sm = { day: 'numeric', month: 'short' };
  switch (period) {
    case 'day':    return f.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    case 'week':   return `${f.toLocaleDateString(locale, sm)} — ${t.toLocaleDateString(locale, sm)}`;
    case 'month':  return `${months[f.getMonth()]} ${f.getFullYear()}`;
    case 'year':   return String(f.getFullYear());
    case 'custom':
      if (from === to) return f.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
      return `${f.toLocaleDateString(locale, sm)} — ${t.toLocaleDateString(locale, sm)}`;
    default: return '';
  }
}

function buildBadge(period, anchor) {
  const d = new Date(anchor + 'T00:00:00');
  if (period === 'day')    return d.getDate();
  if (period === 'week')   return '7';
  if (period === 'month')  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (period === 'year')   return '365';
  if (period === 'custom') return '↔';
  return '?';
}

function shiftAnchor(anchor, period, dir) {
  const d = new Date(anchor + 'T00:00:00');
  switch (period) {
    case 'day':   d.setDate(d.getDate() + dir); break;
    case 'week':  d.setDate(d.getDate() + dir * 7); break;
    case 'month': d.setMonth(d.getMonth() + dir); break;
    case 'year':  d.setFullYear(d.getFullYear() + dir); break;
    default: return anchor;
  }
  return iso(d);
}

export default function ReportsScreen() {
  const { currency, fmt, fmtC } = useCurrency();
  const { t } = useLanguage();
  const now = new Date();
  const locale = t('locale');
  const months = t('months');

  const [period,     setPeriod]    = useState('month');
  const [anchor,     setAnchor]    = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customFrom, setCF]        = useState(iso(now));
  const [customTo,   setCT]        = useState(iso(now));
  const [showCal,    setShowCal]   = useState(false);
  const [showSheet,  setShowSheet] = useState(false);
  const [tab,        setTab]       = useState('expense');
  const [stats,      setStats]     = useState([]);
  const [totals,     setTotals]    = useState({ income: 0, expense: 0, balance: 0 });
  const [extended,   setExtended]  = useState({ dayAvg: 0, todayTotal: 0, weekTotal: 0 });
  const [dailyBothBars, setDailyBothBars] = useState([]);

  const range = period === 'custom'
    ? { from: customFrom, to: customTo }
    : rangeForPeriod(period, anchor);

  const load = useCallback(async () => {
    const cur = currency.code;
    const [s, all, ext, bothDaily] = await Promise.all([
      getCategoryStats({ type: tab, dateFrom: range.from, dateTo: range.to, currency: cur }),
      getCategoryStats({ dateFrom: range.from, dateTo: range.to, currency: cur }),
      getExtendedStats({ type: tab, dateFrom: range.from, dateTo: range.to, currency: cur }),
      getDailyDataBoth({ dateFrom: range.from, dateTo: range.to, currency: cur }),
    ]);
    const income  = all.filter(x => x.type === 'income').reduce((a, x) => a + x.total, 0);
    const expense = all.filter(x => x.type === 'expense').reduce((a, x) => a + x.total, 0);
    setTotals({ income, expense, balance: income - expense });
    setStats(s.filter(x => x.total > 0));
    setExtended(ext);
    setDailyBothBars(bothDaily);
  }, [tab, range.from, range.to, currency.code]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = stats.reduce((s, x) => s + x.total, 0);
  const maxBothBar = Math.max(...dailyBothBars.map(d => Math.max(d.income, d.expense)), 1);
  const canShift = period !== 'custom';

  const currLabel = buildPeriodLabel(period, range.from, range.to, months, locale).toUpperCase();
  const currBadge = buildBadge(period, anchor);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        canShift && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15,
      onPanResponderRelease: (_, { dx }) => {
        if (!canShift) return;
        if (dx > 50)       setAnchor(a => shiftAnchor(a, period, -1));
        else if (dx < -50) setAnchor(a => shiftAnchor(a, period, 1));
      },
    })
  ).current;

  const selectPeriod = (key) => {
    setShowSheet(false);
    if (key === 'custom') { setShowCal(true); return; }
    setPeriod(key);
    if (key === 'month') setAnchor(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    else setAnchor(iso(now));
  };

  return (
    <View style={s.container} {...swipePan.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Hero */}
        <GradientHero>
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <View style={s.heroLabelRow}>
                <Text style={s.heroLabel}>{t('analytics')}</Text>
                <View style={s.currencyBadge}>
                  <Text style={s.currencyBadgeTxt}>{currency.flag} {currency.code}</Text>
                </View>
              </View>
              <Text
                style={[s.heroBalance, { color: totals.balance >= 0 ? '#A8FFE0' : '#FFB3B5' }]}
                numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}
              >
                {fmt(totals.balance)}
              </Text>
              <Text style={s.heroSub}>{t('period_total')}</Text>
            </View>
          </View>
          <View style={s.heroStats}>
            <HeroStat icon="arrow-up"   iconBg="rgba(0,196,140,0.25)" iconColor="#00E6A8" label={t('income')}  value={fmtC(totals.income)}  />
            <View style={s.heroDivider} />
            <HeroStat icon="arrow-down" iconBg="rgba(255,90,95,0.25)" iconColor="#FF8A8E" label={t('expense')} value={fmtC(totals.expense)} />
          </View>
        </GradientHero>

        {/* Period selector */}
        <View style={s.monthRow}>
          {canShift ? (
            <TouchableOpacity style={s.monthArrow} onPress={() => setAnchor(a => shiftAnchor(a, period, -1))} activeOpacity={0.7}>
              <Text style={s.monthArrowTxt}>{'«'}</Text>
            </TouchableOpacity>
          ) : <View style={s.monthArrow} />}

          <TouchableOpacity style={s.monthPill} onPress={() => setShowSheet(true)} activeOpacity={0.8}>
            <View style={s.monthDayBox}>
              <Text style={s.monthDayTxt}>{currBadge}</Text>
            </View>
            <Text style={s.monthPillTxt}>{currLabel}</Text>
            <Ionicons name="chevron-down" size={13} color={Colors.expense} />
          </TouchableOpacity>

          {canShift ? (
            <TouchableOpacity style={s.monthArrow} onPress={() => setAnchor(a => shiftAnchor(a, period, 1))} activeOpacity={0.7}>
              <Text style={s.monthArrowTxt}>{'»'}</Text>
            </TouchableOpacity>
          ) : <View style={s.monthArrow} />}
        </View>

        {/* Toggle cards */}
        <View style={s.toggleRow}>
          <ToggleCard
            label={t('expense')} value={totals.expense}
            color={Colors.expense} lightBg={Colors.expenseLight}
            active={tab === 'expense'} onPress={() => setTab('expense')}
          />
          <ToggleCard
            label={t('income')} value={totals.income}
            color={Colors.income} lightBg={Colors.incomeLight}
            active={tab === 'income'} onPress={() => setTab('income')}
          />
        </View>

        {/* Daily bar chart */}
        {dailyBothBars.length > 0 && (
          <Card style={s.chartCard} variant="row" padding={16}>
            <View style={s.chartBars}>
              {dailyBothBars.map((d, i) => {
                const incH = d.income  > 0 ? Math.max((d.income  / maxBothBar) * 80, 3) : 0;
                const expH = d.expense > 0 ? Math.max((d.expense / maxBothBar) * 80, 3) : 0;
                const day = new Date(d.date + 'T00:00:00').getDate();
                const isToday = d.date === iso(now);
                return (
                  <View key={i} style={s.barCol}>
                    <View style={s.barPair}>
                      {incH > 0 ? <View style={[s.bar, { height: incH, backgroundColor: Colors.income,  opacity: isToday ? 1 : 0.6 }]} /> : <View style={s.barEmpty} />}
                      {expH > 0 ? <View style={[s.bar, { height: expH, backgroundColor: Colors.expense, opacity: isToday ? 1 : 0.6 }]} /> : <View style={s.barEmpty} />}
                    </View>
                    {(i === 0 || day % 7 === 1 || isToday)
                      ? <Text style={[s.barLbl, isToday && { color: Colors.primary, fontWeight: '700' }]}>{day}</Text>
                      : <Text style={s.barLblEmpty} />}
                  </View>
                );
              })}
            </View>
            <View style={s.chartLegend}>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.income  }]} /><Text style={s.legTxt}>{t('income')}</Text></View>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.expense }]} /><Text style={s.legTxt}>{t('expense')}</Text></View>
            </View>
          </Card>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatPill label={t('day_avg')} value={extended.dayAvg}    color={Colors.textSecondary} />
          <StatPill label={t('today')}   value={extended.todayTotal} color={tab === 'expense' ? Colors.expense : Colors.income} />
          <StatPill label={t('week')}    value={extended.weekTotal}  color={Colors.primary} />
        </View>

        {/* Category breakdown */}
        {stats.length === 0 ? (
          <EmptyState icon="bar-chart-outline" title={t('no_data')} subtitle={t('add_ops_period')} />
        ) : (
          <View style={s.catList}>
            {stats.map(item => {
              const pct = total > 0 ? item.total / total : 0;
              return (
                <Card key={item.id} style={s.catRow} variant="row" radius={16} padding={14}>
                  <View style={[s.catIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={s.catBody}>
                    <View style={s.catTop}>
                      <Text style={s.catName}>{item.name}</Text>
                      <Text style={[s.catTotal, { color: item.color }]}>{fmt(item.total)}</Text>
                    </View>
                    <View style={s.trackBg}>
                      <View style={[s.trackFill, { width: `${pct * 100}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={s.catMeta}>{(pct * 100).toFixed(1)}%  &middot;  {item.count} {t('ops_suffix')}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Period bottom sheet */}
      <Modal visible={showSheet} transparent animationType="fade">
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setShowSheet(false)} />
          <AnalyticsPeriodSheet
            period={period} anchor={anchor}
            months={months} locale={locale}
            onSelect={selectPeriod} onClose={() => setShowSheet(false)}
            t={t}
          />
        </View>
      </Modal>

      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        mode="range"
        from={range.from}
        to={range.to}
        onApply={(f, tv) => { setCF(f); setCT(tv); setPeriod('custom'); setShowCal(false); }}
      />
    </View>
  );
}

// ─── Period Sheet ─────────────────────────────────────────────

function AnalyticsPeriodSheet({ period, anchor, months, locale, onSelect, onClose, t }) {
  const d = new Date(anchor + 'T00:00:00');
  const weekMon = new Date(d);
  weekMon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sm = { day: 'numeric', month: 'short' };
  const weekLabel  = `${weekMon.toLocaleDateString(locale, sm)} – ${addDays(weekMon, 6).toLocaleDateString(locale, sm)}`;
  const monthLabel = `${months[d.getMonth()]} ${d.getFullYear()}`;
  const ys = t('year_suffix');
  const yearLabel  = ys ? `${d.getFullYear()} ${ys}` : `${d.getFullYear()}`;

  const OPTS = [
    { key: 'day',    badge: String(d.getDate()), label: t('day'),          sub: d.toLocaleDateString(locale, sm) },
    { key: 'week',   badge: '7',                 label: t('week'),         sub: weekLabel },
    { key: 'month',  badge: String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()), label: t('month'), sub: monthLabel },
    { key: 'year',   badge: '365',               label: t('year'),         sub: yearLabel },
    { key: 'custom', badge: '↔',            label: t('choose_range'), sub: '' },
  ];

  return (
    <View style={ps.sheet}>
      <View style={ps.handle} />
      <View style={ps.header}>
        <Text style={ps.title}>{t('period')}</Text>
        <TouchableOpacity onPress={onClose} style={ps.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={ps.grid}>
        {OPTS.map(opt => {
          const active = period === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[ps.option, active && ps.optionActive]}
              onPress={() => onSelect(opt.key)}
              activeOpacity={0.75}
            >
              <View style={[ps.iconBox, active && ps.iconBoxActive]}>
                <Text style={[ps.badgeTxt, active && { color: '#fff' }]}>{opt.badge}</Text>
              </View>
              <Text style={[ps.optLabel, active && ps.optLabelActive]}>{opt.label}</Text>
              {opt.sub ? <Text style={[ps.optSub, active && ps.optSubActive]} numberOfLines={1}>{opt.sub}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function ToggleCard({ label, value, color, lightBg, active, onPress }) {
  const { fmtC } = useCurrency();
  return (
    <TouchableOpacity
      style={[s.toggleCard, active ? { backgroundColor: color } : { backgroundColor: lightBg }]}
      onPress={onPress} activeOpacity={0.85}
    >
      <Text style={[s.toggleLabel, { color: active ? '#fff' : color }]}>{label}</Text>
      <Text style={[s.toggleAmt, { color: active ? '#fff' : color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {fmtC(value)}
      </Text>
      {active && (
        <View style={s.toggleCheck}>
          <Ionicons name="checkmark" size={14} color={color} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatPill({ label, value, color }) {
  const { fmtC } = useCurrency();
  return (
    <Card style={s.statPill} variant="row" radius={16} padding={12}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {fmtC(value)}
      </Text>
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xl, gap: Spacing.md },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  currencyBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  currencyBadgeTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },
  heroBalance: { ...Typography.heroBalance },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18, padding: 14,
  },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.bg,
  },
  monthArrow: { padding: 10 },
  monthArrowTxt: { fontSize: 22, fontWeight: '800', color: Colors.expense },
  monthPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.expenseLight, borderRadius: Radius.xxl,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: Spacing.sm, gap: Spacing.sm,
  },
  monthDayBox: {
    width: 32, height: 32, borderRadius: Radius.sm,
    borderWidth: 2, borderColor: Colors.expense,
    alignItems: 'center', justifyContent: 'center',
  },
  monthDayTxt: { fontSize: 12, fontWeight: '800', color: Colors.expense },
  monthPillTxt: { fontSize: 13, fontWeight: '800', color: Colors.expense, letterSpacing: 0.3, flexShrink: 1 },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  toggleRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, gap: 10, marginBottom: 14, marginTop: 4 },
  toggleCard: {
    flex: 1, borderRadius: Radius.xl, padding: 18,
    justifyContent: 'center', gap: 4, minHeight: 90,
    ...Shadows.card,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600' },
  toggleAmt:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  toggleCheck: {
    position: 'absolute', top: 12, right: 12,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },

  chartCard: {
    marginHorizontal: Spacing.lg, marginBottom: 14,
  },
  chartBars:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100 },
  barCol:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barPair:     { flexDirection: 'row', gap: 1, alignItems: 'flex-end' },
  bar:         { width: 4, borderRadius: 3, minHeight: 3 },
  barEmpty:    { width: 4 },
  barLbl:      { fontSize: 9, color: Colors.textMuted },
  barLblEmpty: { fontSize: 9, color: 'transparent' },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot:      { width: 8, height: 8, borderRadius: 4 },
  legTxt:      { fontSize: 12, color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: 14 },
  statPill: { flex: 1, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  statValue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },

  catList: { marginHorizontal: Spacing.lg, gap: Spacing.sm },
  catRow: { flexDirection: 'row', gap: 12 },
  catIcon:  { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  catBody:  { flex: 1 },
  catTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  catName:  { fontSize: 14, fontWeight: '600', color: Colors.text },
  catTotal: { fontSize: 14, fontWeight: '800' },
  trackBg:  { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, marginBottom: 4 },
  trackFill:{ height: 6, borderRadius: 3 },
  catMeta:  { fontSize: 11, color: Colors.textMuted },

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
  title:    { ...Typography.title },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
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
    marginBottom: 4, borderWidth: 1.5, borderColor: Colors.border,
  },
  iconBoxActive: { backgroundColor: '#6C47FF', borderColor: '#6C47FF' },
  badgeTxt:       { fontSize: 13, fontWeight: '800', color: Colors.text },
  optLabel:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  optLabelActive: { color: '#fff' },
  optSub:         { fontSize: 11, color: Colors.textMuted },
  optSubActive:   { color: 'rgba(255,255,255,0.65)' },
});
