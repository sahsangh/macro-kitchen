import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MacroGrid } from '@/components/macros';
import { MealPicker } from '@/components/MealPicker';
import { PortionPicker } from '@/components/PortionPicker';
import { Button, Card, ErrorText, Field, Loading, Row, Screen, Segmented, SectionHeader, success, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { post } from '@/lib/api';
import { defaultMeal, prettyDate, today } from '@/lib/date';
import { backToTab, useFlowParams } from '@/lib/flow';
import { fmt, fmtG, per100 } from '@/lib/macros';
import { recipeDraft } from '@/lib/recipeDraft';
import { useFetch } from '@/lib/useFetch';
import type { Food, Meal } from '@/lib/types';

const SOURCE_LABEL = { usda: 'USDA FoodData Central', off: 'Open Food Facts', custom: 'Your custom food' };

export default function FoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const flow = useFlowParams();
  const { data, error } = useFetch<{ food: Food }>(`/foods/${id}`);
  const [grams, setGrams] = useState<number | undefined>();
  const [meal, setMeal] = useState<Meal>(flow.meal ?? defaultMeal());
  const [pkgWeight, setPkgWeight] = useState('');
  const [pkgUnit, setPkgUnit] = useState<'g' | 'ml'>('g');
  const [pkgServings, setPkgServings] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading />;
  const food = data.food;
  const date = flow.date ?? today();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setSaveError(null);
    try {
      await fn();
      success();
    } catch (e: any) {
      setSaveError(e.message);
      setBusy(false);
    }
  };

  const log = () =>
    run(async () => {
      await post('/logs', { kind: 'food', foodId: food._id, grams, date, meal });
      backToTab('/');
    });

  const addToRecipe = () => {
    recipeDraft.addIngredient({ food: food._id, name: food.brand ? `${food.name} (${food.brand})` : food.name, grams: Math.round(grams! * 10) / 10, per100g: food.per100g });
    success();
    router.dismissTo('/recipe/edit');
  };

  const pkgG = Number(pkgWeight) * (pkgUnit === 'ml' ? food.density ?? 1 : 1);
  const track = () =>
    run(async () => {
      await post('/batches', { foodId: food._id, totalWeightG: pkgG, servings: Number(pkgServings) || (food.servingSizeG ? pkgG / food.servingSizeG : 1) });
      backToTab('/pantry');
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 4 }}>
        <T variant="title" style={{ fontSize: 24 }}>{food.name}</T>
        {food.brand && <T muted>{food.brand}</T>}
        <T variant="caption">
          {SOURCE_LABEL[food.source]}
          {food.servingSizeG ? ` · 1 serving = ${food.servingLabel && food.servingLabel !== `${food.servingSizeG} g` ? `${food.servingLabel}, ` : ''}${fmt(food.servingSizeG)} g` : ''}
        </T>
      </View>

      {flow.mode === 'track' ? (
        <Card style={{ gap: Space.md }}>
          <T muted>How much of it do you have? It’ll go in your pantry so you can eat it down over time.</T>
          <Segmented value={pkgUnit} onChange={setPkgUnit} options={[{ value: 'g', label: 'By weight (g)' }, { value: 'ml', label: 'By volume (ml)' }]} />
          <Row gap={Space.sm}>
            <Field label={pkgUnit === 'ml' ? 'Total volume (ml)' : 'Total weight (g)'} value={pkgWeight} onChangeText={setPkgWeight} keyboardType="decimal-pad" placeholder={pkgUnit === 'ml' ? 'e.g. 1750' : 'e.g. 907'} style={{ flex: 1 }} autoFocus />
            <Field label="Servings in it" value={pkgServings} onChangeText={setPkgServings} keyboardType="decimal-pad" placeholder={food.servingSizeG && pkgG ? fmt(pkgG / food.servingSizeG, 1) : '1'} style={{ flex: 1 }} />
          </Row>
          {pkgG > 0 && (
            <>
              <SectionHeader title="Whole package" />
              <MacroGrid m={per100(food.per100g, pkgG)} />
            </>
          )}
          <ErrorText>{saveError}</ErrorText>
          <Button title="Add to pantry" icon="file-tray-stacked" onPress={track} loading={busy} disabled={!(pkgG > 0)} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: Space.md }}>
            <PortionPicker whole={{ servingSizeG: food.servingSizeG, density: food.density ?? 1 }} initialMode={flow.mode === 'ingredient' ? 'g' : undefined} onChange={setGrams} />
          </Card>
          <SectionHeader title={grams ? `Nutrition for ${fmtG(grams)}` : 'Nutrition'} />
          <MacroGrid m={per100(food.per100g, grams ?? 0)} />
          <T variant="caption" style={{ textAlign: 'center' }}>
            Per 100 g: {fmt(food.per100g.calories)} kcal · P {fmt(food.per100g.protein, 1)} · C {fmt(food.per100g.carbs, 1)} · F {fmt(food.per100g.fat, 1)} · Fb {fmt(food.per100g.fiber ?? 0, 1)}
          </T>
          {flow.mode === 'log' ? (
            <>
              <MealPicker value={meal} onChange={setMeal} />
              <ErrorText>{saveError}</ErrorText>
              <Button title={`Add to ${date === today() ? 'today' : prettyDate(date)}`} icon="checkmark" onPress={log} loading={busy} disabled={!grams} />
              <Button title="Track a package of this in pantry" kind="ghost" icon="file-tray-stacked-outline" onPress={() => router.push({ pathname: '/food/[id]', params: { id: food._id, mode: 'track' } })} />
            </>
          ) : (
            <Button title="Add to recipe" icon="add" onPress={addToRecipe} disabled={!grams} />
          )}
        </>
      )}
    </Screen>
  );
}
