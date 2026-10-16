import { useState } from 'react';

import { MealPicker } from '@/components/MealPicker';
import { Button, ErrorText, Field, Row, Screen, success } from '@/components/ui';
import { Space } from '@/constants/theme';
import { post } from '@/lib/api';
import { defaultMeal, today } from '@/lib/date';
import { backToTab, useFlowParams } from '@/lib/flow';
import type { Meal } from '@/lib/types';

export default function QuickAddScreen() {
  const flow = useFlowParams();
  const [name, setName] = useState('');
  const [m, setM] = useState({ calories: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [meal, setMeal] = useState<Meal>(flow.meal ?? defaultMeal());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof m) => (t: string) => setM({ ...m, [k]: t });
  const num = (s: string) => Number(s.replace(',', '.')) || 0;

  const save = async () => {
    setBusy(true);
    try {
      await post('/logs', {
        kind: 'quick',
        name,
        date: flow.date ?? today(),
        meal,
        macros: { calories: num(m.calories), protein: num(m.protein), carbs: num(m.carbs), fat: num(m.fat), fiber: num(m.fiber) },
      });
      success();
      backToTab('/');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Field label="What was it? (optional)" value={name} onChangeText={setName} placeholder="Restaurant burrito" />
      <Field label="Calories" value={m.calories} onChangeText={set('calories')} keyboardType="decimal-pad" autoFocus />
      <Row gap={Space.sm}>
        <Field label="Protein g" value={m.protein} onChangeText={set('protein')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Carbs g" value={m.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Fat g" value={m.fat} onChangeText={set('fat')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Fiber g" value={m.fiber} onChangeText={set('fiber')} keyboardType="decimal-pad" style={{ flex: 1 }} />
      </Row>
      <MealPicker value={meal} onChange={setMeal} />
      <ErrorText>{error}</ErrorText>
      <Button title="Add" onPress={save} loading={busy} disabled={!m.calories && !m.protein && !m.carbs && !m.fat} />
    </Screen>
  );
}
