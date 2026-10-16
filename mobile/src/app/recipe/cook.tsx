import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MacroGrid } from '@/components/macros';
import { Button, Card, Chip, ErrorText, Field, Loading, Row, Screen, SectionHeader, success, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { post } from '@/lib/api';
import { fmt, fmtG, scale } from '@/lib/macros';
import { useFetch } from '@/lib/useFetch';
import type { Batch, Recipe } from '@/lib/types';

const MULTIPLIERS = [0.5, 1, 1.5, 2, 3];

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFetch<{ recipe: Recipe }>(`/recipes/${id}`);
  const [multiplier, setMultiplier] = useState(1);
  const [weight, setWeight] = useState('');
  const [servings, setServings] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Loading />;
  const r = data.recipe;

  const expectedWeight = r.totalWeightG * multiplier;
  const expectedServings = r.servings * multiplier;
  const w = Number(weight) || expectedWeight;
  const s = Number(servings) || expectedServings;
  const totals = scale(r.totals, multiplier);

  const make = async () => {
    setBusy(true);
    try {
      const { batch } = await post<{ batch: Batch }>(`/recipes/${r._id}/cook`, { multiplier, totalWeightG: w, servings: s });
      success();
      router.replace({ pathname: '/batch/[id]', params: { id: batch._id } });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T variant="h2">{r.name}</T>
      <T muted>This adds it to your pantry, so you can log servings and track what’s left.</T>
      <SectionHeader title="How much did you make?" />
      <Row gap={Space.sm} style={{ flexWrap: 'wrap' }}>
        {MULTIPLIERS.map((m) => (
          <Chip key={m} label={`${m}×`} active={m === multiplier} onPress={() => setMultiplier(m)} />
        ))}
      </Row>
      <Card style={{ gap: Space.md }}>
        <Row gap={Space.sm}>
          <Field label="Actual weight (g)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={fmt(expectedWeight)} style={{ flex: 1 }} />
          <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="decimal-pad" placeholder={fmt(expectedServings, 1)} style={{ flex: 1 }} />
        </Row>
        <T variant="caption">If you weighed it after cooking, enter that — servings and percentages will use the real weight. 1 serving = {fmtG(w / s)}.</T>
      </Card>
      <SectionHeader title="Whole batch" />
      <MacroGrid m={totals} />
      <ErrorText>{error}</ErrorText>
      <Button title="Add to pantry" icon="file-tray-stacked" onPress={make} loading={busy} />
    </Screen>
  );
}
