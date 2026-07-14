import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const HERO_PURPLE = ['#6C47FF', '#9B6BFF', '#C084FC'];

export default function GradientHero({ colors = HERO_PURPLE, children, style }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.hero, style]}
    >
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: {
    paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
});
