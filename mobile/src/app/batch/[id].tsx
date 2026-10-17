import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { MacroGrid, MacroLine, RemainingBar } from '@/components/macros';
import { MealPicker } from '@/components/MealPicker';
import { PortionPicker } from '@/components/PortionPicker';
import { Button, Card, Divider, ErrorText, Field, IconButton, ListRow, Loading, Row, Screen, SectionHeader, Segmented, success, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { del, patch, post } from '@/lib/api';
import { defaultMeal, prettyDate, relativeDays, today } from '@/lib/date';
import { fmt, fmtG, scale } from '@/lib/macros';
import { backToTab } from '@/lib/flow';
import { useFetch } from '@/lib/useFetch';
import type { Batch, BatchEvent, Meal } from '@/lib/types';

const EVENT_LABEL: Record<BatchEvent['type'], string> = { made: 'Made', eat: 'Ate', discard: 'Threw out', restore: 'Put back', adjust: 'Adjusted' };
const EVENT_ICON = { made: 'restaurant', eat: 'checkmark-circle', discard: 'trash', restore: 'arrow-undo', adjust: 'scale' } as const;

export default function BatchScreen() {
  const c = useTheme();
  const { id, date: dateParam, meal: mealParam } = useLocalSearchParams<{ id: string; date?: string; meal?: Meal }>();
  const { data, error, setData } = useFetch<{ batch: Batch }>(`/batches/${id}`);
  const [action, setAction] = useState<'eat' | 'discard'>('eat');
  const [grams, setGrams] = useState<number | undefined>();
  const [meal, setMeal] = useState<Meal>(mealParam ?? defaultMeal());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingLeft, setEditingLeft] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading />;
  const b = data.batch;
  const date = dateParam ?? today();
  const whole = { totalWeightG: b.totalWeightG, servings: b.servings, density: b.density ?? 1 };
  const servingG = b.totalWeightG / b.servings;
  const perGram = scale(b.totals, 1 / b.totalWeightG);
  const active = b.status === 'active';

  const run = async (fn: () => Promise<Batch>, message: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const batch = await fn();
      success();
      setData({ batch });
      setMsg(message);
      setPickerKey((k) => k + 1);
      // Came here from the diary: go straight back to it.
      if (dateParam && action === 'eat') backToTab('/');
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const eat = () =>
    run(async () => (await post<{ batch: Batch }>(`/batches/${b._id}/eat`, { grams, date, meal })).batch, `Logged ${fmtG(grams!)} to ${prettyDate(date).toLowerCase()}`);

  const discard = (all: boolean) => {
    const amount = all ? b.remainingG : grams!;
    Alert.alert(all ? 'Throw out the rest?' : `Throw out ${fmtG(amount)}?`, all ? `${fmtG(b.remainingG)} will be removed from your pantry.` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Throw out', style: 'destructive', onPress: () => run(async () => (await post<{ batch: Batch }>(`/batches/${b._id}/discard`, all ? { all: true } : { grams })).batch, `Threw out ${fmtG(amount)}`) },
    ]);
  };

  const saveLeft = () => {
    const v = Number(editingLeft);
    if (!(v >= 0)) return;
    setEditingLeft(null);
    run(async () => (await patch<{ batch: Batch }>(`/batches/${b._id}`, { remainingG: v })).batch, `Updated to ${fmtG(v)} left`);
  };

  const remove = () =>
    Alert.alert('Delete from pantry?', 'Diary entries already logged from it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/batches/${b._id}`); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <IconButton icon="trash-outline" color={c.danger} onPress={remove} /> }} />
      <View style={{ gap: 4 }}>
        <T variant="title">{b.name}</T>
        <T muted>
          Made {relativeDays(b.madeAt)} · {fmtG(b.totalWeightG)} · {fmt(b.servings, 1)} servings of {fmtG(servingG)}
        </T>
      </View>

      <Card style={{ gap: Space.md }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <T variant="label">Left</T>
            <T variant="title" style={{ fontVariant: ['tabular-nums'] }}>{fmt(b.remainingG / servingG, 1)} <T muted style={{ fontSize: 18 }}>servings</T></T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T variant="number">{fmtG(b.remainingG)}</T>
            <T variant="caption">{fmt((b.remainingG / b.totalWeightG) * 100)}% of batch</T>
          </View>
        </Row>
        <RemainingBar remaining={b.remainingG} total={b.totalWeightG} />
        <MacroLine m={scale(perGram, b.remainingG)} />
        {!active && <T style={{ fontWeight: '700' }} color={b.status === 'discarded' ? c.danger : c.accent}>{b.status === 'discarded' ? 'Thrown out' : 'All eaten'}</T>}
        {editingLeft === null ? (
          <T variant="caption" color={c.accent} style={{ fontWeight: '600' }} onPress={() => setEditingLeft(String(Math.round(b.remainingG)))}>
            Weighed it? Correct the amount left
          </T>
        ) : (
          <Row gap={Space.sm}>
            <Field value={editingLeft} onChangeText={setEditingLeft} keyboardType="decimal-pad" autoFocus style={{ flex: 1 }} />
            <T muted>g</T>
            <Button small title="Save" onPress={saveLeft} />
            <Button small kind="ghost" title="Cancel" onPress={() => setEditingLeft(null)} />
          </Row>
        )}
      </Card>

      {msg && (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <T color={c.accent} style={{ fontWeight: '600' }}>✓ {msg}</T>
        </Row>
      )}

      {active && (
        <Card style={{ gap: Space.md }}>
          <Segmented value={action} onChange={setAction} options={[{ value: 'eat', label: 'Eat' }, { value: 'discard', label: 'Throw out' }]} />
          <PortionPicker key={pickerKey} whole={whole} maxG={b.remainingG} initialGrams={Math.min(servingG, b.remainingG)} onChange={setGrams} />
          {grams ? <MacroGrid m={scale(perGram, grams)} /> : null}
          {action === 'eat' ? (
            <>
              <MealPicker value={meal} onChange={setMeal} />
              <ErrorText>{actionError}</ErrorText>
              <Button title={`Log to ${prettyDate(date).toLowerCase()}`} icon="checkmark" onPress={eat} loading={busy} disabled={!grams || grams > b.remainingG + 0.5} />
            </>
          ) : (
            <>
              <ErrorText>{actionError}</ErrorText>
              <Button title={grams ? `Throw out ${fmtG(grams)}` : 'Throw out'} kind="danger" icon="trash" onPress={() => discard(false)} loading={busy} disabled={!grams || grams > b.remainingG + 0.5} />
              <Button title="Throw out everything left" kind="ghost" onPress={() => discard(true)} />
            </>
          )}
        </Card>
      )}

      <SectionHeader title="Per serving" />
      <MacroGrid m={scale(perGram, servingG)} />

      <SectionHeader title="History" />
      <Card style={{ paddingVertical: Space.xs }}>
        {[...b.events].reverse().map((e, i) => (
          <View key={i}>
            {i > 0 && <Divider />}
            <ListRow
              icon={EVENT_ICON[e.type]}
              title={`${EVENT_LABEL[e.type]} ${fmtG(Math.abs(e.grams))}`}
              subtitle={new Date(e.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              right={<T variant="caption">{fmt(Math.abs(e.grams) / servingG, 2)} sv</T>}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
