import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

export default function PeriodPill({ canNavigate, badge, label, onPrev, onNext, onPress }) {
  return (
    <View style={s.monthRow}>
      {canNavigate ? (
        <TouchableOpacity style={s.monthArrow} onPress={onPrev} activeOpacity={0.7}>
          <Text style={s.monthArrowTxt}>{'«'}</Text>
        </TouchableOpacity>
      ) : <View style={s.monthArrow} />}

      <TouchableOpacity style={s.monthPill} onPress={onPress} activeOpacity={0.8}>
        <View style={s.monthDayBox}>
          <Text style={s.monthDayTxt}>{badge}</Text>
        </View>
        <Text style={s.monthPillTxt}>{label}</Text>
        <Ionicons name="chevron-down" size={13} color={Colors.expense} />
      </TouchableOpacity>

      {canNavigate ? (
        <TouchableOpacity style={s.monthArrow} onPress={onNext} activeOpacity={0.7}>
          <Text style={s.monthArrowTxt}>{'»'}</Text>
        </TouchableOpacity>
      ) : <View style={s.monthArrow} />}
    </View>
  );
}

const s = StyleSheet.create({
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
});
