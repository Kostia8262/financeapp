import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export default function EmptyState({ icon, title, subtitle, iconColor = Colors.primary, iconBg = Colors.primaryLight }) {
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={32} color={iconColor} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptyText}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted },
});
