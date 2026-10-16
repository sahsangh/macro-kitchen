import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorText, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { post } from '@/lib/api';
import { flowParams, useFlowParams } from '@/lib/flow';
import type { Food } from '@/lib/types';

export default function CustomFoodScreen() {
  const params = flowParams(useFlowParams());
  const initial = useLocalSearchParams<{ name?: string; barcode?: string }>();
  const [name, setName] = useState(initial.name ?? '');
  const [brand, setBrand] = useState('');
  const [basis, setBasis] = useState<'serving' | '100g'>('serving');
  const [servingG, setServingG] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [m, setM] = useState({ calories: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => Number(s.replace(',', '.')) || 0;
  const set = (k: keyof typeof m) => (t: string) => setM({ ...m, [k]: t });
  const valid = name.trim() && m.calories && (basis === '100g' || num(servingG) > 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { food } = await post<{ food: Food }>('/foods', {
        name,
        brand,
        barcode: initial.barcode,
        basisG: basis === '100g' ? 100 : num(servingG),
        servingSizeG: num(servingG) || undefined,
        servingLabel: servingLabel || undefined,
        macros: { calories: num(m.calories), protein: num(m.protein), carbs: num(m.carbs), fat: num(m.fat), fiber: num(m.fiber) },
      });
      router.replace({ pathname: '/food/[id]', params: { id: food._id, ...params } });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      {initial.barcode && <T variant="caption">Barcode {initial.barcode} will be saved with this food so the next scan finds it.</T>}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Protein bar" autoFocus={!name} />
      <Field label="Brand (optional)" value={brand} onChangeText={setBrand} />
      <Row gap={Space.sm}>
        <Field label="Serving size (g)" value={servingG} onChangeText={setServingG} keyboardType="decimal-pad" placeholder="e.g. 60" style={{ flex: 1 }} />
        <Field label="Serving name (optional)" value={servingLabel} onChangeText={setServingLabel} placeholder="1 bar" style={{ flex: 1 }} />
      </Row>
      <T variant="label">Nutrition is per</T>
      <Segmented value={basis} onChange={setBasis} options={[{ value: 'serving', label: 'Serving' }, { value: '100g', label: '100 g' }]} />
      <Field label="Calories" value={m.calories} onChangeText={set('calories')} keyboardType="decimal-pad" />
      <Row gap={Space.sm}>
        <Field label="Protein g" value={m.protein} onChangeText={set('protein')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Carbs g" value={m.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Fat g" value={m.fat} onChangeText={set('fat')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Fiber g" value={m.fiber} onChangeText={set('fiber')} keyboardType="decimal-pad" style={{ flex: 1 }} />
      </Row>
      <ErrorText>{error}</ErrorText>
      <Button title="Save food" onPress={save} loading={busy} disabled={!valid} />
    </Screen>
  );
}
