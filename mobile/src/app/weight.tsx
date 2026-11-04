import { useState } from 'react';
import { Alert, View } from 'react-native';

import { LineChart } from '@/components/LineChart';
import { Button, Card, Divider, ErrorText, Field, ListRow, Row, Screen, SectionHeader, Segmented, T, success } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { del, put } from '@/lib/api';
import { prettyDate, shiftDate, today } from '@/lib/date';
import { useUnits } from '@/lib/units';
import { useFetch } from '@/lib/useFetch';
import type { BodyWeight } from '@/lib/types';

const RANGES = { '30': 30, '90': 90, '365': 365 } as const;
const toTime = (d: string) => new Date(`${d}T12:00:00`).getTime();

export default function WeightScreen() {
  const c = useTheme();
  const u = useUnits();
  const [range, setRange] = useState<keyof typeof RANGES>('90');
  const { data, reload } = useFetch<{ weights: BodyWeight[] }>(`/weights?from=${shiftDate(today(), -RANGES[range])}`);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weights = data?.weights ?? [];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await put(`/weights/${date}`, { weightKg: u.toKg(Number(value.replace(',', '.'))) });
      success();
      setValue('');
      reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // 7-entry moving average smooths out day-to-day water weight.
  const smoothed = weights.map((w, i) => {
    const window = weights.slice(Math.max(0, i - 6), i + 1);
    return { x: toTime(w.date), y: u.toDisplay(window.reduce((n, x) => n + x.weightKg, 0) / window.length) };
  });
  const first = weights[0];
  const last = weights.at(-1);
  const change = first && last && first !== last ? u.toDisplay(last.weightKg - first.weightKg) : null;

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Card style={{ gap: Space.md }}>
        <Row gap={Space.sm} style={{ alignItems: 'flex-end' }}>
          <Field label={`Weight (${u.unit})`} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder={last ? u.w(last.weightKg) : ''} style={{ flex: 1 }} autoFocus={!weights.length} />
          <Button title="Save" onPress={save} loading={busy} disabled={!(Number(value) > 0)} />
        </Row>
        <Segmented value={date} onChange={setDate} options={[{ value: today(), label: 'Today' }, { value: shiftDate(today(), -1), label: 'Yesterday' }]} />
        <ErrorText>{error}</ErrorText>
      </Card>

      {weights.length > 0 && (
        <Card style={{ gap: Space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T variant="caption">Latest</T>
              <T variant="number" style={{ fontSize: 26 }}>{u.wU(last!.weightKg)}</T>
            </View>
            {change !== null && (
              <View style={{ alignItems: 'flex-end' }}>
                <T variant="caption">Change ({range} days)</T>
                <T variant="number" style={{ fontSize: 20 }} color={change <= 0 ? c.accent : c.warning}>
                  {change > 0 ? '+' : ''}{Math.round(change * 10) / 10} {u.unit}
                </T>
              </View>
            )}
          </Row>
          <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: '1 year' }]} />
          {smoothed.length >= 2 ? (
            <>
              <LineChart points={smoothed} format={(v) => `${Math.round(v * 10) / 10}`} />
              <T variant="caption">Line shows a 7-entry average, so daily water swings don’t hide the trend.</T>
            </>
          ) : (
            <T variant="caption">Log a few more days to see your trend.</T>
          )}
        </Card>
      )}

      {weights.length > 0 && (
        <>
          <SectionHeader title="Entries" />
          <Card style={{ paddingVertical: Space.xs }}>
            {[...weights].reverse().map((w, i) => (
              <View key={w._id}>
                {i > 0 && <Divider />}
                <ListRow
                  title={u.wU(w.weightKg)}
                  subtitle={prettyDate(w.date)}
                  onPress={() =>
                    Alert.alert(prettyDate(w.date), u.wU(w.weightKg), [
                      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/weights/${w.date}`); reload(); } },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
