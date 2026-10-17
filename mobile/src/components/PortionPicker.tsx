import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Radius, Space, useTheme } from '@/constants/theme';
import { fmt, fmtG } from '@/lib/macros';
import { fromGrams, parseAmount, PortionMode, servingSize, toGrams, Whole } from '@/lib/portion';

import { Chip, Row, Segmented, T } from './ui';

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function textFor(grams: number, mode: PortionMode, whole: Whole) {
  const v = fromGrams(grams, mode, whole);
  if (v === undefined) return '';
  return String(round(v, mode === 'g' || mode === 'ml' ? 0 : mode === 'pct' ? 1 : 2));
}

/**
 * Enter a portion as grams, servings or % of the whole — all three stay in
 * sync and the parent always receives grams.
 */
export function PortionPicker({
  whole,
  maxG,
  initialGrams,
  initialMode,
  onChange,
}: {
  whole: Whole;
  maxG?: number;
  initialGrams?: number;
  initialMode?: PortionMode;
  onChange: (grams: number | undefined) => void;
}) {
  const c = useTheme();
  const hasServing = !!servingSize(whole);
  const hasWhole = !!whole.totalWeightG;
  const hasMl = whole.density !== undefined;
  const startMode: PortionMode = initialMode ?? (hasServing ? 'servings' : 'g');
  const [mode, setMode] = useState<PortionMode>(startMode);
  const [text, setText] = useState(() =>
    initialGrams ? textFor(initialGrams, startMode, whole) : startMode === 'servings' ? '1' : '100',
  );

  const grams = useMemo(() => {
    const raw = parseAmount(text);
    // In % mode, "1/3" means a third, not a third of a percent.
    const value = mode === 'pct' && text.includes('/') ? raw * 100 : raw;
    return toGrams(value, mode, whole);
  }, [text, mode, whole]);

  useEffect(() => onChange(grams), [grams]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (m: PortionMode) => {
    if (grams) setText(textFor(grams, m, whole));
    setMode(m);
  };
  const setGrams = (g: number) => setText(textFor(g, mode, whole));

  const chips: { label: string; grams: number }[] = [];
  const s = servingSize(whole);
  const density = whole.density || 1;
  if (mode === 'g') [50, 100, 150, 200].forEach((g) => chips.push({ label: `${g} g`, grams: g }));
  if (mode === 'ml') [100, 250, 350, 500].forEach((ml) => chips.push({ label: `${ml} ml`, grams: ml * density }));
  if (mode === 'servings' && s) [['½', 0.5], ['1', 1], ['1½', 1.5], ['2', 2]].forEach(([l, n]) => chips.push({ label: String(l), grams: (n as number) * s }));
  if (mode === 'pct' && whole.totalWeightG) [['¼', 0.25], ['⅓', 1 / 3], ['½', 0.5], ['Whole', 1]].forEach(([l, f]) => chips.push({ label: String(l), grams: (f as number) * whole.totalWeightG! }));
  const visibleChips = chips.filter((ch) => !maxG || ch.grams <= maxG + 0.5);
  if (maxG && maxG > 0) visibleChips.push({ label: 'All left', grams: maxG });

  const suffix = mode === 'g' ? 'g' : mode === 'ml' ? 'ml' : mode === 'pct' ? '%' : s && round(s, 0) !== 1 ? `× ${fmt(s)} g` : 'servings';
  const over = maxG !== undefined && grams !== undefined && grams > maxG + 0.5;

  const others: string[] = [];
  if (grams) {
    if (mode === 'ml') others.push(density === 1 ? fmtG(grams) : `${fmtG(grams)} (${density} g/ml)`);
    else if (mode !== 'g') others.push(fmtG(grams));
    if (mode !== 'servings' && s) others.push(`${fmt(grams / s, 2)} serving${round(grams / s, 2) === 1 ? '' : 's'}`);
    if (mode !== 'pct' && whole.totalWeightG) others.push(`${fmt((grams / whole.totalWeightG) * 100, 1)}% of whole`);
  }

  return (
    <View style={{ gap: Space.md }}>
      <Segmented
        value={mode}
        onChange={switchMode}
        options={[
          ...(hasServing ? [{ value: 'servings' as const, label: 'Servings' }] : []),
          { value: 'g' as const, label: 'Grams' },
          ...(hasMl ? [{ value: 'ml' as const, label: 'mL' }] : []),
          ...(hasWhole ? [{ value: 'pct' as const, label: 'Fraction' }] : []),
        ]}
      />
      <Row gap={Space.sm} style={{ backgroundColor: c.cardAlt, borderRadius: Radius.md, paddingHorizontal: 16, borderWidth: 1.5, borderColor: over ? c.danger : 'transparent' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="numbers-and-punctuation"
          selectTextOnFocus
          returnKeyType="done"
          placeholder="0"
          placeholderTextColor={c.textMuted}
          style={{ flex: 1, minWidth: 0, fontSize: 32, fontWeight: '700', color: c.text, paddingVertical: 10, fontVariant: ['tabular-nums'] }}
        />
        <T muted style={{ fontSize: 18, fontWeight: '600' }}>{suffix}</T>
      </Row>
      <T variant="caption" color={over ? c.danger : undefined}>
        {over ? `Only ${fmtG(maxG!)} left` : others.length ? `= ${others.join('  ·  ')}` : mode === 'pct' ? 'Type a % or a fraction like 1/3' : ' '}
      </T>
      <Row gap={Space.sm} style={{ flexWrap: 'wrap' }}>
        {visibleChips.map((ch) => (
          <Chip key={ch.label} label={ch.label} onPress={() => setGrams(ch.grams)} active={grams !== undefined && Math.abs(grams - ch.grams) < 0.5} />
        ))}
      </Row>
    </View>
  );
}
