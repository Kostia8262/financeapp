import React, { useCallback, useState } from 'react';
import {
  Alert, View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getInsights, getMonthlyTrend } from '../database/db';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import Card from '../components/ui/Card';
import GradientHero from '../components/ui/GradientHero';
import HeroStat from '../components/ui/HeroStat';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 80;

export default function BalanceScreen() {
  const { currency, fmt, fmtC } = useCurrency();
  const { t } = useLanguage();
  const [data, setData]         = useState(null);
  const [trend, setTrend]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ins, tr] = await Promise.all([
        getInsights(currency.code),
        getMonthlyTrend(6, currency.code),
      ]);
      setData(ins);
      setTrend(tr);
    } catch (e) {
      Alert.alert(t('error'), t('load_error_msg'));
    }
  }, [currency.code, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data) return <View style={s.container} />;

  const {
    balance, curIncome, curExpense,
    prevExpense, dailyAvg, projected,
    runway, savings, expGrowth, topCat,
    daysInMonth, daysPassed,
  } = data;

  const balanceColor = balance >= 0 ? Colors.income : Colors.expense;
  const insights = buildInsights(data, fmtC, t);
  const maxTrend = Math.max(...trend.map(row => Math.max(row.income, row.expense)), 1);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Hero balance ── */}
        <GradientHero
          colors={balance >= 0 ? [Colors.income, '#00A876', '#009E6E'] : [Colors.expense, '#E83E44', '#CC2D32']}
        >
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>{t('total_balance')}</Text>
              <Text style={s.heroBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                {fmt(balance)}
              </Text>
              <Text style={s.heroSub}>{t('this_month')}</Text>
            </View>
          </View>
          <View style={s.heroStats}>
            <HeroStat icon="arrow-up"    iconBg={Colors.income + '40'}  iconColor="#A8FFE0" label={t('income')}       value={fmtC(curIncome)}  />
            <View style={s.heroDivider} />
            <HeroStat icon="arrow-down"  iconBg={Colors.expense + '40'}  iconColor="#FFB3B5" label={t('expense')}      value={fmtC(curExpense)} />
            <View style={s.heroDivider} />
            <HeroStat icon="trending-up" iconBg="rgba(255,255,255,0.2)" iconColor={Colors.white} label={t('savings_rate')} value={`${savings}%`}   />
          </View>
        </GradientHero>

        <View style={{ height: Spacing.lg }} />

        {/* ── Monthly trend chart ── */}
        {trend.length > 1 && (
          <Card style={s.card} padding={18}>
            <Text style={s.cardTitle}>{t('trend_6m')}</Text>
            <View style={s.trendChart}>
              {trend.map((row, i) => {
                const incH = Math.max((row.income  / maxTrend) * CHART_H, 2);
                const expH = Math.max((row.expense / maxTrend) * CHART_H, 2);
                const monthsShort = t('monthsShort');
                const label = row.month ? monthsShort[parseInt(row.month.split('-')[1]) - 1] : '';
                return (
                  <View key={i} style={s.trendCol}>
                    <View style={s.trendBars}>
                      <View style={[s.trendBar, { height: incH, backgroundColor: Colors.income }]} />
                      <View style={[s.trendBar, { height: expH, backgroundColor: Colors.expense }]} />
                    </View>
                    <Text style={s.trendLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={s.trendLegend}>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.income  }]} /><Text style={s.legTxt}>{t('income')}</Text></View>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.expense }]} /><Text style={s.legTxt}>{t('expense')}</Text></View>
            </View>
          </Card>
        )}

        {/* ── Quick stats ── */}
        <View style={s.statsGrid}>
          <StatCard
            icon="flame"
            iconColor={Colors.warning}
            iconBg={Colors.warningLight}
            label={t('per_day')}
            value={fmtC(dailyAvg)}
            sub={t('daily_expenses')}
          />
          <StatCard
            icon="calendar"
            iconColor={Colors.primary}
            iconBg={Colors.primaryLight}
            label={t('forecast_month')}
            value={fmtC(projected)}
            sub={`${daysInMonth} ${t('days_short')}`}
          />
          <StatCard
            icon="timer-outline"
            iconColor={runway !== null && runway > 30 ? Colors.income : Colors.expense}
            iconBg={runway !== null && runway > 30 ? Colors.incomeLight : Colors.expenseLight}
            label={t('enough_days')}
            value={runway !== null ? `${runway} ${t('days_short')}` : '∞'}
            sub={t('at_cur_exp')}
          />
          <StatCard
            icon="save-outline"
            iconColor={savings >= 0 ? Colors.income : Colors.expense}
            iconBg={savings >= 0 ? Colors.incomeLight : Colors.expenseLight}
            label={t('savings_rate')}
            value={`${savings}%`}
            sub={t('this_month')}
          />
        </View>

        {/* ── Month progress ── */}
        <Card style={s.card} padding={18}>
          <Text style={s.cardTitle}>{t('month')}: {daysPassed} / {daysInMonth}</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, {
              width: `${Math.min((daysPassed / daysInMonth) * 100, 100)}%`,
              backgroundColor: Colors.primary,
            }]} />
          </View>
          <View style={s.progressRow}>
            <View>
              <Text style={s.progressLbl}>{t('spent')}</Text>
              <Text style={[s.progressVal, { color: Colors.expense }]}>{fmtC(curExpense)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.progressLbl}>{t('end_forecast')}</Text>
              <Text style={[s.progressVal, { color: Colors.primary }]}>{fmtC(projected)}</Text>
            </View>
          </View>
        </Card>

        {/* ── Smart insights ── */}
        <Card style={[s.card, { marginBottom: Spacing.sm }]} padding={18}>
          <Text style={s.cardTitle}>{t('smart_tips')}</Text>
          <View style={s.insightsList}>
            {insights.map((tip, i) => (
              <View key={i} style={[s.insightRow, i === insights.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[s.insightIcon, { backgroundColor: tip.color + '18' }]}>
                  <Ionicons name={tip.icon} size={18} color={tip.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle}>{tip.title}</Text>
                  <Text style={s.insightBody}>{tip.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

      </ScrollView>
    </View>
  );
}

// ─── Dynamic insights generator ────────────────────────────────

function buildInsights(d, fmtC, t) {
  const tips = [];
  const { balance, curIncome, curExpense, prevExpense, projected, runway, savings, expGrowth, topCat, dailyAvg } = d;

  if (curExpense > curIncome && curIncome > 0) {
    tips.push({
      icon: 'warning-outline', color: Colors.expense,
      title: t('tip_overspend_title'),
      body: `${t('tip_overspend_body_pre')}${fmtC(curExpense - curIncome)}${t('tip_overspend_body_suf')}`,
    });
  } else if (savings >= 20) {
    tips.push({
      icon: 'star', color: Colors.income,
      title: t('tip_great_savings_title'),
      body: `${t('tip_great_savings_body_pre')}${savings}${t('tip_great_savings_body_suf')}`,
    });
  } else if (savings > 0) {
    tips.push({
      icon: 'trending-up', color: Colors.primary,
      title: `${t('tip_savings_rate_title_pre')}${savings}%`,
      body: t('tip_savings_rate_body'),
    });
  }

  if (expGrowth !== null) {
    if (expGrowth > 20) {
      tips.push({
        icon: 'arrow-up-circle', color: Colors.expense,
        title: `${t('tip_expense_grew_title_pre')}${expGrowth}${t('tip_expense_grew_title_suf')}`,
        body: t('tip_expense_grew_body'),
      });
    } else if (expGrowth < -10) {
      tips.push({
        icon: 'arrow-down-circle', color: Colors.income,
        title: `${t('tip_expense_dropped_title_pre')}${Math.abs(expGrowth)}${t('tip_expense_dropped_title_suf')}`,
        body: t('tip_expense_dropped_body'),
      });
    }
  }

  if (topCat) {
    tips.push({
      icon: 'pie-chart', color: topCat.color || Colors.primary,
      title: `${t('tip_top_category_title_pre')}${topCat.name}`,
      body: `${fmtC(topCat.total)}${t('tip_top_category_body_suf')}`,
    });
  }

  if (runway !== null && runway < 30 && runway >= 0) {
    tips.push({
      icon: 'hourglass', color: Colors.warning,
      title: `${t('tip_runway_title_pre')}${runway}${t('tip_runway_title_suf')}`,
      body: t('tip_runway_body'),
    });
  }

  if (dailyAvg > 0) {
    tips.push({
      icon: 'analytics-outline', color: Colors.primary,
      title: t('tip_daily_avg_title'),
      body: `${t('tip_daily_avg_body_pre')}${fmtC(dailyAvg)}${t('tip_daily_avg_body_mid')}${fmtC(projected)}${t('tip_daily_avg_body_suf')}`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      icon: 'information-circle', color: Colors.textMuted,
      title: t('tip_no_data_title'),
      body: t('add_ops_tips'),
    });
  }

  return tips.slice(0, 5);
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({ icon, iconColor, iconBg, label, value, sub }) {
  return (
    <Card style={s.statCard} padding={16}>
      <View style={[s.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: iconColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {value}
      </Text>
      <Text style={s.statSub}>{sub}</Text>
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xl },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 4 },
  heroBalance: { ...Typography.heroBalance, color: Colors.white },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18, padding: 14,
  },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },

  card: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 14 },

  trendChart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 24, gap: 2 },
  trendCol: { flex: 1, alignItems: 'center', gap: 6 },
  trendBars: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  trendBar: { width: 8, borderRadius: 4 },
  trendLabel: { fontSize: 10, color: Colors.textMuted },
  trendLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legTxt: { fontSize: 12, color: Colors.textSecondary },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  statCard: {
    width: (SCREEN_W - Spacing.lg * 2 - 10) / 2,
    gap: 4,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statSub:   { fontSize: 10, color: Colors.textMuted },

  progressBg: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, marginBottom: Spacing.md },
  progressFill: { height: 8, borderRadius: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLbl: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  progressVal: { fontSize: 14, fontWeight: '800' },

  insightsList: { gap: 0 },
  insightRow: {
    flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    alignItems: 'flex-start',
  },
  insightIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  insightBody:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
