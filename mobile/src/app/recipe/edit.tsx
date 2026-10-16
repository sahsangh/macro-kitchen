import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { MacroGrid, MacroLine } from '@/components/macros';
import { Button, Card, Divider, ErrorText, Field, IconButton, Row, Screen, SectionHeader, success, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { post, put } from '@/lib/api';
import { fmt, fmtG, ingredientsTotal, per100, scale } from '@/lib/macros';
import { recipeDraft, useRecipeDraft } from '@/lib/recipeDraft';
import type { Recipe } from '@/lib/types';

export default function RecipeEditScreen() {
  const c = useTheme();
  const d = useRecipeDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawWeight = d.ingredients.reduce((s, i) => s + (i.grams || 0), 0);
  const weight = Number(d.totalWeightG) || rawWeight;
  const servings = Number(d.servings) || 1;
  const totals = ingredientsTotal(d.ingredients);

  const setIngGrams = (idx: number, text: string) =>
    recipeDraft.set({ ingredients: d.ingredients.map((ing, i) => (i === idx ? { ...ing, grams: Number(text.replace(',', '.')) || 0 } : ing)) });
  const removeIng = (idx: number) => recipeDraft.set({ ingredients: d.ingredients.filter((_, i) => i !== idx) });
  const setExtra = (idx: number, k: 'name' | 'amount', v: string) =>
    recipeDraft.set({ extras: d.extras.map((x, i) => (i === idx ? { ...x, [k]: v } : x)) });

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { name: d.name, servings, totalWeightG: weight, ingredients: d.ingredients, extras: d.extras, notes: d.notes };
    try {
      const { recipe } = d.id ? await put<{ recipe: Recipe }>(`/recipes/${d.id}`, body) : await post<{ recipe: Recipe }>('/recipes', body);
      success();
      if (d.id) router.back();
      else router.replace({ pathname: '/recipe/[id]', params: { id: recipe._id } });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: d.id ? 'Edit recipe' : 'New recipe',
          headerLeft: () => <Button small kind="ghost" title="Cancel" onPress={() => router.back()} />,
          headerRight: () => <Button small kind="ghost" title="Save" onPress={save} disabled={!d.name.trim() || !(weight > 0) || busy} />,
        }}
      />
      <Field placeholder="Recipe name" value={d.name} onChangeText={(name) => recipeDraft.set({ name })} style={{ fontSize: 20, fontWeight: '700' }} />

      <SectionHeader title={`Ingredients · ${fmtG(rawWeight)}`} />
      <Card style={{ paddingVertical: Space.sm, gap: 0 }}>
        {d.ingredients.length === 0 && <T muted style={{ paddingVertical: Space.sm }}>Search, scan, or pick recent foods to add ingredients.</T>}
        {d.ingredients.map((ing, i) => (
          <View key={ing._key ?? i}>
            {i > 0 && <Divider />}
            <Row gap={Space.sm} style={{ paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <T numberOfLines={2} style={{ fontWeight: '600' }}>{ing.name}</T>
                <MacroLine m={per100(ing.per100g, ing.grams)} />
              </View>
              <Row gap={2} style={{ backgroundColor: c.cardAlt, borderRadius: Radius.sm, paddingHorizontal: 8 }}>
                <TextInput
                  defaultValue={String(ing.grams)}
                  onChangeText={(t) => setIngGrams(i, t)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={{ width: 56, textAlign: 'right', paddingVertical: 6, color: c.text, fontWeight: '600', fontSize: 15 }}
                />
                <T muted>g</T>
              </Row>
              <IconButton icon="remove-circle-outline" color={c.danger} onPress={() => removeIng(i)} />
            </Row>
          </View>
        ))}
        <Button kind="ghost" icon="add" title="Add ingredient" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'ingredient' } })} />
      </Card>

      <SectionHeader title="No-macro extras" />
      <Card style={{ gap: Space.sm }}>
        <T variant="caption">Spices, herbs, water — anything you want in the recipe that doesn’t count toward macros.</T>
        {d.extras.map((x, i) => (
          <Row key={i} gap={Space.sm}>
            <Field value={x.name} onChangeText={(v) => setExtra(i, 'name', v)} placeholder="e.g. Cumin" style={{ flex: 2 }} />
            <Field value={x.amount} onChangeText={(v) => setExtra(i, 'amount', v)} placeholder="1 tsp" style={{ flex: 1 }} />
            <IconButton icon="remove-circle-outline" color={c.danger} onPress={() => recipeDraft.set({ extras: d.extras.filter((_, j) => j !== i) })} />
          </Row>
        ))}
        <Button kind="ghost" icon="add" title="Add extra" onPress={() => recipeDraft.set({ extras: [...d.extras, { name: '', amount: '' }] })} />
      </Card>

      <SectionHeader title="Yield" />
      <Card style={{ gap: Space.md }}>
        <Row gap={Space.sm}>
          <Field label="Servings it makes" value={d.servings} onChangeText={(servings) => recipeDraft.set({ servings })} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field
            label="Final weight (g)"
            value={d.totalWeightG}
            onChangeText={(totalWeightG) => recipeDraft.set({ totalWeightG })}
            keyboardType="decimal-pad"
            placeholder={rawWeight ? fmt(rawWeight) : ''}
            style={{ flex: 1 }}
          />
        </Row>
        <Row gap={6}>
          <Ionicons name="information-circle-outline" size={16} color={c.textSecondary} />
          <T variant="caption" style={{ flex: 1 }}>Weigh the finished dish. Cooking changes the weight but not the macros. Leave blank to use the ingredient total.</T>
        </Row>
        {weight > 0 && <T variant="caption">1 serving = {fmtG(weight / servings)}</T>}
      </Card>

      <SectionHeader title="Per serving" />
      <MacroGrid m={scale(totals, 1 / servings)} />
      <T variant="caption" style={{ textAlign: 'center' }}>
        Whole recipe: {fmt(totals.calories)} kcal · P {fmt(totals.protein)} · C {fmt(totals.carbs)} · F {fmt(totals.fat)} · Fb {fmt(totals.fiber)}
      </T>

      <Field label="Notes" value={d.notes} onChangeText={(notes) => recipeDraft.set({ notes })} multiline placeholder="Steps, tips…" style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save recipe" onPress={save} loading={busy} disabled={!d.name.trim() || !(weight > 0)} />
    </Screen>
  );
}
