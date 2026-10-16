import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Radius, useTheme } from '@/constants/theme';
import { fmt } from '@/lib/macros';
import type { Macros } from '@/lib/types';

import { Row, T } from './ui';

/** Compact "P 30 · C 40 · F 10" line with colored dots. */
export function MacroLine({ m, showCalories = true, size = 'caption' }: { m: Macros; showCalories?: boolean; size?: 'caption' | 'body' }) {
  const c = useTheme();
  const items = [
    { key: 'P', v: m.protein, color: c.protein },
    { key: 'C', v: m.carbs, color: c.carbs },
    { key: 'F', v: m.fat, color: c.fat },
    { key: 'Fb', v: m.fiber, color: c.fiber },
  ];
  return (
    <Row gap={10} style={{ flexWrap: 'wrap' }}>
      {showCalories && <T variant={size} style={{ fontWeight: '700' }} color={c.text}>{fmt(m.calories)} kcal</T>}
      {items.map((i) => (
        <Row key={i.key} gap={4}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i.color }} />
          <T variant={size}>{i.key} {fmt(i.v)}g</T>
        </Row>
      ))}
    </Row>
  );
}

/** Four big numbers, used on detail screens. */
export function MacroGrid({ m }: { m: Macros }) {
  const c = useTheme();
  const items = [
    { label: 'Calories', v: fmt(m.calories), color: c.calories },
    { label: 'Protein', v: `${fmt(m.protein, 1)}g`, color: c.protein },
    { label: 'Carbs', v: `${fmt(m.carbs, 1)}g`, color: c.carbs },
    { label: 'Fat', v: `${fmt(m.fat, 1)}g`, color: c.fat },
    { label: 'Fiber', v: `${fmt(m.fiber, 1)}g`, color: c.fiber },
  ];
  return (
    <Row gap={6}>
      {items.map((i) => (
        <View key={i.label} style={{ flex: 1, backgroundColor: c.cardAlt, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', gap: 2 }}>
          <T variant="number" style={{ fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit color={i.color}>{i.v}</T>
          <T variant="caption" style={{ fontSize: 11 }}>{i.label}</T>
        </View>
      ))}
    </Row>
  );
}

export function Ring({ value, goal, size = 150, stroke = 14, color, children }: { value: number; goal: number; size?: number; stroke?: number; color: string; children?: React.ReactNode }) {
  const c = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? c.warning : color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}

export function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const c = useTheme();
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="caption" style={{ fontWeight: '600' }} color={c.text}>{label}</T>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: value > goal ? c.warning : color }} />
      </View>
      <T variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
        {fmt(value)} / {fmt(goal)}g
      </T>
    </View>
  );
}

/** Horizontal remaining-amount bar for active foods. */
export function RemainingBar({ remaining, total }: { remaining: number; total: number }) {
  const c = useTheme();
  const pct = total > 0 ? Math.max(0, Math.min(remaining / total, 1)) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: pct < 0.2 ? c.warning : c.accent, borderRadius: 3 }} />
    </View>
  );
}
