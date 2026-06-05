import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getInsights, getMonthlyTrend } from '../database/db';
import { MONTH_NAMES } from '../utils/format';
import { Colors } from '../theme/colors';
import { useCurrency } from '../context/CurrencyContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 80;

export default function BalanceScreen() {
  const { currency, fmt, fmtC } = useCurrency();
  const [data, setData]         = useState(null);
  const [trend, setTrend]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [ins, tr] = await Promise.all([
      getInsights(currency.code),
      getMonthlyTrend(6, currency.code),
    ]);
    setData(ins);
    setTrend(tr);
  }, [currency.code]);

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
  const insights = buildInsights(data, fmtC);
  const maxTrend = Math.max(...trend.map(t => Math.max(t.income, t.expense)), 1);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Hero balance ── */}
        <LinearGradient
          colors={balance >= 0 ? ['#00C48C', '#00A876', '#009E6E'] : ['#FF5A5F', '#E83E44', '#CC2D32']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroLabel}>Общий баланс</Text>
          <Text style={s.heroBalance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
            {fmt(balance)}
          </Text>
          <View style={s.heroRow}>
            <View style={s.heroPill}>
              <Ionicons name="arrow-down" size={11} color="#fff" />
              <Text style={s.heroPillTxt}>{fmtC(curIncome)}</Text>
            </View>
            <View style={[s.heroPill, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
              <Ionicons name="arrow-up" size={11} color="#fff" />
              <Text style={s.heroPillTxt}>{fmtC(curExpense)}</Text>
            </View>
            {savings !== 0 && (
              <View style={[s.heroPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Ionicons name="trending-up" size={11} color="#fff" />
                <Text style={s.heroPillTxt}>{savings}% сберегает</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Monthly trend chart ── */}
        {trend.length > 1 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Тренд за 6 месяцев</Text>
            <View style={s.trendChart}>
              {trend.map((t, i) => {
                const incH = Math.max((t.income  / maxTrend) * CHART_H, 2);
                const expH = Math.max((t.expense / maxTrend) * CHART_H, 2);
                const label = t.month ? MONTH_NAMES[parseInt(t.month.split('-')[1]) - 1] : '';
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
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.income  }]} /><Text style={s.legTxt}>Доходы</Text></View>
              <View style={s.legItem}><View style={[s.legDot, { backgroundColor: Colors.expense }]} /><Text style={s.legTxt}>Расходы</Text></View>
            </View>
          </View>
        )}

        {/* ── Quick stats ── */}
        <View style={s.statsGrid}>
          <StatCard
            icon="flame"
            iconColor="#FF9F43"
            iconBg="#FFF4E6"
            label="В день (ср.)"
            value={fmtC(dailyAvg)}
            sub="расходы"
          />
          <StatCard
            icon="calendar"
            iconColor={Colors.primary}
            iconBg={Colors.primaryLight}
            label="Прогноз/месяц"
            value={fmtC(projected)}
            sub={`за ${daysInMonth} дней`}
          />
          <StatCard
            icon="timer-outline"
            iconColor={runway !== null && runway > 30 ? Colors.income : Colors.expense}
            iconBg={runway !== null && runway > 30 ? Colors.incomeLight : Colors.expenseLight}
            label="Хватит на"
            value={runway !== null ? `${runway} дн.` : '∞'}
            sub="при текущих расходах"
          />
          <StatCard
            icon="save-outline"
            iconColor={savings >= 0 ? Colors.income : Colors.expense}
            iconBg={savings >= 0 ? Colors.incomeLight : Colors.expenseLight}
            label="Норма сбережений"
            value={`${savings}%`}
            sub="этот месяц"
          />
        </View>

        {/* ── Month progress ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Месяц: день {daysPassed} из {daysInMonth}</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, {
              width: `${Math.min((daysPassed / daysInMonth) * 100, 100)}%`,
              backgroundColor: Colors.primary,
            }]} />
          </View>
          <View style={s.progressRow}>
            <View>
              <Text style={s.progressLbl}>Потрачено</Text>
              <Text style={[s.progressVal, { color: Colors.expense }]}>{fmtC(curExpense)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.progressLbl}>Прогноз к концу</Text>
              <Text style={[s.progressVal, { color: Colors.primary }]}>{fmtC(projected)}</Text>
            </View>
          </View>
        </View>

        {/* ── Smart insights ── */}
        <View style={[s.card, { marginBottom: 8 }]}>
          <Text style={s.cardTitle}>Умные подсказки</Text>
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
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Dynamic insights generator ────────────────────────────────

function buildInsights(d, fmtC) {
  const tips = [];
  const { balance, curIncome, curExpense, prevExpense, projected, runway, savings, expGrowth, topCat, dailyAvg } = d;

  if (curExpense > curIncome && curIncome > 0) {
    tips.push({
      icon: 'warning-outline', color: Colors.expense,
      title: 'Расходы превышают доходы',
      body: `Превышение: ${fmtC(curExpense - curIncome)}. Попробуйте сократить необязательные расходы.`,
    });
  } else if (savings >= 20) {
    tips.push({
      icon: 'star', color: Colors.income,
      title: 'Отличный уровень сбережений',
      body: `Вы сберегаете ${savings}% дохода — это выше нормы. Продолжайте в том же духе!`,
    });
  } else if (savings > 0) {
    tips.push({
      icon: 'trending-up', color: Colors.primary,
      title: `Норма сбережений: ${savings}%`,
      body: 'Рекомендуется откладывать не менее 20% дохода. Попробуйте увеличить на 5%.',
    });
  }

  if (expGrowth !== null) {
    if (expGrowth > 20) {
      tips.push({
        icon: 'arrow-up-circle', color: Colors.expense,
        title: `Расходы выросли на ${expGrowth}%`,
        body: 'По сравнению с прошлым месяцем траты значительно увеличились.',
      });
    } else if (expGrowth < -10) {
      tips.push({
        icon: 'arrow-down-circle', color: Colors.income,
        title: `Расходы снизились на ${Math.abs(expGrowth)}%`,
        body: 'Отличный прогресс! Экономия по сравнению с прошлым месяцем.',
      });
    }
  }

  if (topCat) {
    tips.push({
      icon: 'pie-chart', color: topCat.color || Colors.primary,
      title: `Главная статья: ${topCat.name}`,
      body: `${fmtC(topCat.total)} в этом месяце. Проверьте, можно ли оптимизировать.`,
    });
  }

  if (runway !== null && runway < 30 && runway >= 0) {
    tips.push({
      icon: 'hourglass', color: Colors.warning,
      title: `Баланса хватит на ${runway} дней`,
      body: 'Рекомендуется пополнить баланс или снизить ежедневные расходы.',
    });
  }

  if (dailyAvg > 0) {
    tips.push({
      icon: 'analytics-outline', color: Colors.primary,
      title: 'Ежедневные расходы',
      body: `В среднем ${fmtC(dailyAvg)}/день. Прогноз до конца месяца: ${fmtC(projected)}.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      icon: 'information-circle', color: Colors.textMuted,
      title: 'Добавьте операции',
      body: 'Внесите доходы и расходы, чтобы увидеть персональные подсказки.',
    });
  }

  return tips.slice(0, 5);
}

// ─── Sub-components ───────────────────────────────────────────

function StatCard({ icon, iconColor, iconBg, label, value, sub }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: iconColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {value}
      </Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    paddingTop: 60, paddingBottom: 28, paddingHorizontal: 20,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 16,
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 6 },
  heroBalance: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  heroPillTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },

  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.bgCard, borderRadius: 20,
    padding: 18, elevation: 3, shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
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
    marginHorizontal: 16, marginBottom: 12,
  },
  statCard: {
    width: (SCREEN_W - 16 * 2 - 10) / 2,
    backgroundColor: Colors.bgCard, borderRadius: 18,
    padding: 16, gap: 4, elevation: 3,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statSub:   { fontSize: 10, color: Colors.textMuted },

  progressBg: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, marginBottom: 12 },
  progressFill: { height: 8, borderRadius: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLbl: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  progressVal: { fontSize: 14, fontWeight: '800' },

  insightsList: { gap: 0 },
  insightRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    alignItems: 'flex-start',
  },
  insightIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  insightBody:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
