import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, PanResponder,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCategoryStats, getExtendedStats, getDailyData, getDailyDataBoth } from '../database/db';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import CalendarModal from '../components/CalendarModal';

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

function periodLabel(period, from, to, months, locale) {
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
  const PERIODS = [
    { key: 'day',    label: t('day') },
    { key: 'week',   label: t('week') },
    { key: 'month',  label: t('month') },
    { key: 'year',   label: t('year') },
    { key: 'custom', label: '📅' },
  ];
  const [period, setPeriod]     = useState('month');

  const [anchor, setAnchor]     = useState(iso(now));
  const [customFrom, setCF]     = useState(iso(now));
  const [customTo,   setCT]     = useState(iso(now));
  const [showCal, setShowCal]   = useState(false);
  const [tab, setTab]           = useState('expense');
  const [stats, setStats]       = useState([]);
  const [totals, setTotals]     = useState({ income: 0, expense: 0, balance: 0 });
  const [extended, setExtended] = useState({ dayAvg: 0, todayTotal: 0, weekTotal: 0 });
  const [dailyBars, setDailyBars] = useState([]);
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

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        canShift && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15,
      onPanResponderRelease: (_, { dx }) => {
        if (!canShift) return;
        if (dx > 50) setAnchor(a => shiftAnchor(a, period, -1));
        else if (dx < -50) setAnchor(a => shiftAnchor(a, period, 1));
      },
    })
  ).current;

  return (
    <View style={s.container} {...swipePan.panHandlers}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero header ── */}
        <LinearGradient
          colors={['#6C47FF', '#9B6BFF', '#C084FC']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroTitle}>{t('analytics')}</Text>
          <Text
            style={[s.heroBalance, { color: totals.balance >= 0 ? '#A8FFE0' : '#FFB3B5' }]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}
          >
            {fmt(totals.balance)}
          </Text>
          <Text style={s.heroSub}>{t('period_total')}</Text>
        </LinearGradient>

        {/* ── Period selector ── */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => { if (p.key === 'custom') setShowCal(true); else setPeriod(p.key); }}
            >
              <Text style={[s.periodTxt, period === p.key && s.periodTxtActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Period navigation ── */}
        <View style={s.navRow}>
          {canShift ? (
            <TouchableOpacity style={s.navArrow} onPress={() => setAnchor(a => shiftAnchor(a, period, -1))}>
              <Ionicons name="chevron-back" size={18} color={Colors.text} />
            </TouchableOpacity>
          ) : <View style={s.navArrow} />}
          <TouchableOpacity style={s.navCenter} onPress={() => setShowCal(true)}>
            <Text style={s.navLabel}>{periodLabel(period, range.from, range.to, months, locale)}</Text>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          {canShift ? (
            <TouchableOpacity style={s.navArrow} onPress={() => setAnchor(a => shiftAnchor(a, period, 1))}>
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
          ) : <View style={s.navArrow} />}
        </View>

        {/* ── Big toggle cards ── */}
        <View style={s.toggleRow}>
          <ToggleCard
            label={t('expense')} value={totals.expense}
            color={Colors.expense} lightBg={Colors.expenseLight}
            active={tab === 'expense'}
            onPress={() => setTab('expense')}
          />
          <ToggleCard
            label={t('income')} value={totals.income}
            color={Colors.income} lightBg={Colors.incomeLight}
            active={tab === 'income'}
            onPress={() => setTab('income')}
          />
        </View>

        {/* ── Daily bar chart (income + expense) ── */}
        {dailyBothBars.length > 0 && (
          <View style={s.chartCard}>
            <View style={s.chartBars}>
              {dailyBothBars.map((d, i) => {
                const incH = d.income  > 0 ? Math.max((d.income  / maxBothBar) * 80, 3) : 0;
                const expH = d.expense > 0 ? Math.max((d.expense / maxBothBar) * 80, 3) : 0;
                const day = new Date(d.date + 'T00:00:00').getDate();
                const isToday = d.date === iso(now);
                return (
                  <View key={i} style={s.barCol}>
                    <View style={s.barPair}>
                      {incH > 0 ? <View style={[s.bar, { height: incH, backgroundColor: Colors.income, opacity: isToday ? 1 : 0.6 }]} /> : <View style={s.barEmpty} />}
                      {expH > 0 ? <View style={[s.bar, { height: expH, backgroundColor: Colors.expense, opacity: isToday ? 1 : 0.6 }]} /> : <View style={s.barEmpty} />}
                    </View>
                    {(i === 0 || day % 7 === 1 || isToday) ? (
                      <Text style={[s.barLbl, isToday && { color: Colors.primary, fontWeight: '700' }]}>
                        {day}
                      </Text>
                    ) : <Text style={s.barLblEmpty} />}
                  </View>
                );
              })}
            </View>
            <View style={s.chartLegend}>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.income  }]} /><Text style={s.legTxt}>{t('income')}</Text></View>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.expense }]} /><Text style={s.legTxt}>{t('expense')}</Text></View>
            </View>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          <StatPill label={t('day_avg')} value={extended.dayAvg}    color={Colors.textSecondary} />
          <StatPill label={t('today')}   value={extended.todayTotal} color={tab === 'expense' ? Colors.expense : Colors.income} />
          <StatPill label={t('week')}    value={extended.weekTotal}  color={Colors.primary} />
        </View>

        {/* ── Category breakdown ── */}
        {stats.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>{t('no_data')}</Text>
            <Text style={s.emptyText}>{t('add_ops_period')}</Text>
          </View>
        ) : (
          <View style={s.catList}>
            {stats.map(item => {
              const pct = total > 0 ? item.total / total : 0;
              return (
                <View key={item.id} style={s.catRow}>
                  <View style={[s.catIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={s.catBody}>
                    <View style={s.catTop}>
                      <Text style={s.catName}>{item.name}</Text>
                      <Text style={[s.catTotal, { color: item.color }]}>
                        {fmt(item.total)}
                      </Text>
                    </View>
                    <View style={s.trackBg}>
                      <View style={[s.trackFill, { width: `${pct * 100}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={s.catMeta}>{(pct * 100).toFixed(1)}%  ·  {item.count} {t('ops_suffix')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        mode="range"
        from={range.from}
        to={range.to}
        onApply={(f, t) => { setCF(f); setCT(t); setPeriod('custom'); }}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function ToggleCard({ label, value, color, lightBg, active, onPress }) {
  const { fmtC } = useCurrency();
  return (
    <TouchableOpacity
      style={[s.toggleCard, active ? { backgroundColor: color } : { backgroundColor: lightBg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[s.toggleLabel, { color: active ? '#fff' : color }]}>{label}</Text>
      <Text
        style={[s.toggleAmt, { color: active ? '#fff' : color }]}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}
      >
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
    <View style={s.statPill}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {fmtC(value)}
      </Text>
    </View>
  );
}

function SumCard({ label, value, color, bg, active, onPress }) {
  const { fmtC } = useCurrency();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[s.sumCard, { backgroundColor: bg }, active && { borderWidth: 2, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && <View style={[s.sumActiveDot, { backgroundColor: color }]} />}
      <Text style={[s.sumAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {fmtC(value)}
      </Text>
      <Text style={s.sumLabel}>{label}</Text>
    </Wrap>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    paddingTop: 56, paddingBottom: 28, paddingHorizontal: 20,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: 16,
  },
  heroTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  heroBalance: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  periodRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: Colors.bgCard, borderRadius: 16,
    padding: 4, marginBottom: 10, gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  periodBtnActive: { backgroundColor: Colors.primaryLight },
  periodTxt: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  periodTxtActive: { color: Colors.primary },

  navRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.bgCard, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  navArrow: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  navCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 12,
  },
  navLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },

  toggleRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 14 },
  toggleCard: {
    flex: 1, borderRadius: 20, padding: 18,
    justifyContent: 'center', gap: 4, minHeight: 90,
    elevation: 3, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
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
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.bgCard, borderRadius: 20,
    padding: 16, elevation: 2, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100 },
  barCol:    { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barPair:   { flexDirection: 'row', gap: 1, alignItems: 'flex-end' },
  bar:       { width: 4, borderRadius: 3, minHeight: 3 },
  barEmpty:  { width: 4 },
  barLbl:    { fontSize: 9, color: Colors.textMuted },
  barLblEmpty: { fontSize: 9, color: 'transparent' },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot:  { width: 8, height: 8, borderRadius: 4 },
  legTxt:  { fontSize: 12, color: Colors.textSecondary },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 14,
  },
  statPill: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 16,
    padding: 12, alignItems: 'center', gap: 4,
    elevation: 2, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4,
  },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  statValue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },

  catList: { marginHorizontal: 16, gap: 8 },
  catRow:  {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.bgCard,
    borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4,
  },
  catIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  catBody: { flex: 1 },
  catTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  catName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  catTotal:{ fontSize: 14, fontWeight: '800' },
  trackBg: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, marginBottom: 4 },
  trackFill:{ height: 6, borderRadius: 3 },
  catMeta: { fontSize: 11, color: Colors.textMuted },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText:  { fontSize: 13, color: Colors.textMuted },

  // Legacy SumCard (kept for safety)
  sumCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 3 },
  sumAmount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sumLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  sumActiveDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
});
