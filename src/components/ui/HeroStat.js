import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HeroStat({ icon, iconBg, iconColor, label, value }) {
  return (
    <View style={s.heroStat}>
      <View style={[s.heroStatIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroStatLabel}>{label}</Text>
        <Text style={s.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  heroStatIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  heroStatValue: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
