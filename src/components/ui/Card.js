import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';

export default function Card({ children, padding, style }) {
  return (
    <View style={[s.card, padding != null && { padding }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.card,
  },
});
