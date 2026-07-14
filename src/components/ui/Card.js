import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';

export default function Card({ children, padding, radius = Radius.xl, variant = 'card', style }) {
  return (
    <View
      style={[
        s.base,
        { borderRadius: radius, ...Shadows[variant] },
        padding != null && { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
});
