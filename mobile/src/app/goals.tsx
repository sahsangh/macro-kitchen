import { router } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorText, Field, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/macros';

export default function GoalsScreen() {
  const c = useTheme();
  const { user, updateProfile } = useAuth();
  const [v, setV] = useState({
    calories: String(user!.goals.calories),
    protein: String(user!.goals.protein),
    carbs: String(user!.goals.carbs),
    fat: String(user!.goals.fat),
    fiber: String(user!.goals.fiber ?? 30),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromMacros = Number(v.protein) * 4 + Number(v.carbs) * 4 + Number(v.fat) * 9;

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile({ goals: { calories: +v.calories, protein: +v.protein, carbs: +v.carbs, fat: +v.fat, fiber: +v.fiber } });
      router.back();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const set = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t.replace(/[^\d.]/g, '') });

  return (
    <Screen>
      <Field label="Calories (kcal)" value={v.calories} onChangeText={set('calories')} keyboardType="number-pad" />
      <Row gap={10}>
        <Field label="Protein (g)" value={v.protein} onChangeText={set('protein')} keyboardType="number-pad" style={{ flex: 1 }} />
        <Field label="Carbs (g)" value={v.carbs} onChangeText={set('carbs')} keyboardType="number-pad" style={{ flex: 1 }} />
        <Field label="Fat (g)" value={v.fat} onChangeText={set('fat')} keyboardType="number-pad" style={{ flex: 1 }} />
      </Row>
      <Field label="Fiber (g)" value={v.fiber} onChangeText={set('fiber')} keyboardType="number-pad" hint="A common target is 25–38 g a day." />
      <T variant="caption">
        Your macros add up to {fmt(fromMacros)} kcal.{' '}
        {Math.abs(fromMacros - Number(v.calories)) > 50 && (
          <T variant="caption" color={c.accent} style={{ fontWeight: '700' }} onPress={() => setV({ ...v, calories: String(Math.round(fromMacros)) })}>
            Use that
          </T>
        )}
      </T>
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={busy} />
    </Screen>
  );
}
