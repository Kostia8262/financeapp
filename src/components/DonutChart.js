import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segment(cx, cy, R, r, startDeg, endDeg) {
  const GAP = 1.5;
  const s = startDeg + GAP / 2;
  const e = endDeg - GAP / 2;
  if (e - s < 0.3) return '';
  const o1 = polar(cx, cy, R, s);
  const o2 = polar(cx, cy, R, e);
  const i1 = polar(cx, cy, r, e);
  const i2 = polar(cx, cy, r, s);
  const lg = e - s > 180 ? 1 : 0;
  return [
    `M${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A${R} ${R} 0 ${lg} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A${r} ${r} 0 ${lg} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export default function DonutChart({
  data = [],
  size = 220,
  label,
  mainAmount,
  mainColor,
  secondaryAmount,
  secondaryColor,
  onPress,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 4;
  const r = R - 44;
  const innerR = r - 6;

  const total = data.reduce((s, d) => s + d.value, 0);

  const CenterContent = (
    <View style={[s.center, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]}>
      {label ? <Text style={s.labelTxt}>{label}</Text> : null}
      <Text
        style={[s.mainAmt, { color: mainColor || Colors.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
      >
        {mainAmount || '0'}
      </Text>
      {secondaryAmount != null ? (
        <Text style={[s.secAmt, { color: secondaryColor || Colors.textMuted }]}>
          {secondaryAmount}
        </Text>
      ) : null}
    </View>
  );

  const Wrap = onPress ? TouchableOpacity : View;
  const wrapProps = onPress ? { onPress, activeOpacity: 0.85 } : {};

  if (total === 0) {
    return (
      <Wrap style={[s.wrap, { width: size, height: size }]} {...wrapProps}>
        <Svg width={size} height={size} style={s.svg}>
          <Circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="#F0F0F6" strokeWidth={R - r} />
        </Svg>
        {CenterContent}
      </Wrap>
    );
  }

  let angle = 0;
  const segs = data.map(d => {
    const sweep = (d.value / total) * 360;
    const seg = { ...d, startDeg: angle, endDeg: angle + sweep };
    angle += sweep;
    return seg;
  });

  return (
    <Wrap style={[s.wrap, { width: size, height: size }]} {...wrapProps}>
      <Svg width={size} height={size} style={s.svg}>
        {/* Background ring */}
        <Circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="#F0F0F6" strokeWidth={R - r} />
        {segs.map((seg, i) => (
          <Path key={i} d={segment(cx, cy, R, r, seg.startDeg, seg.endDeg)} fill={seg.color} />
        ))}
        {/* Inner shadow ring */}
        <Circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={3} />
      </Svg>
      {CenterContent}
    </Wrap>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  labelTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mainAmt: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  secAmt: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
