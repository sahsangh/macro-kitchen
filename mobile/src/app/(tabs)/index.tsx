import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MacroBar, MacroLine, RemainingBar, Ring } from '@/components/macros';
import { Card, Divider, IconButton, ListRow, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { del, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { prettyDate, shiftDate, today } from '@/lib/date';
import { fmt, fmtG, ZERO } from '@/lib/macros';
import { useFetch } from '@/lib/useFetch';
import { Batch, LogEntry, Macros, Meal, MEALS } from '@/lib/types';

const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
const MEAL_ICON = { breakfast: 'sunny', lunch: 'partly-sunny', dinner: 'moon', snack: 'cafe' } as const;

export default function TodayScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const day = useFetch<{ entries: LogEntry[]; totals: Macros }>(`/logs?date=${date}`);
  const pantry = useFetch<{ batches: Batch[] }>('/batches');
  const goals = user!.goals;
  const totals = day.data?.totals ?? ZERO;
  const left = goals.calories - totals.calories;

  const entryActions = (e: LogEntry) => {
    const moveTo = MEALS.filter((m) => m !== e.meal);
    const remove = async () => {
      await del(`/logs/${e._id}`);
      day.reload();
      if (e.kind === 'batch') pantry.reload();
    };
    const move = async (meal: Meal) => {
      await patch(`/logs/${e._id}`, { meal });
      day.reload();
    };
    const removeLabel = e.kind === 'batch' && e.batch ? 'Remove (put back in pantry)' : 'Remove';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: e.name, options: [removeLabel, ...moveTo.map((m) => `Move to ${MEAL_LABEL[m]}`), 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: moveTo.length + 1 },
        (i) => (i === 0 ? remove() : i <= moveTo.length ? move(moveTo[i - 1]) : undefined),
      );
    } else {
      Alert.alert(e.name, undefined, [
        { text: removeLabel, style: 'destructive', onPress: remove },
        ...moveTo.slice(0, 1).map((m) => ({ text: `Move to ${MEAL_LABEL[m]}`, onPress: () => move(m) })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const active = pantry.data?.batches ?? [];

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + Space.sm }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { day.reload(); pantry.reload(); }} tintColor={c.accent} />}>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" onPress={() => setDate(shiftDate(date, -1))} />
        <Pressable onPress={() => setDate(today())}>
          <T variant="h2">{prettyDate(date)}</T>
        </Pressable>
        <IconButton icon="chevron-forward" onPress={() => setDate(shiftDate(date, 1))} />
      </Row>

      <Card style={{ gap: Space.lg }}>
        <Row gap={Space.lg}>
          <Ring value={totals.calories} goal={goals.calories} color={c.calories} size={136}>
            <T variant="number" style={{ fontSize: 28 }}>{fmt(Math.abs(left))}</T>
            <T variant="caption">{left >= 0 ? 'kcal left' : 'kcal over'}</T>
          </Ring>
          <View style={{ flex: 1, gap: Space.sm }}>
            <StatLine label="Goal" value={fmt(goals.calories)} />
            <StatLine label="Eaten" value={fmt(totals.calories)} />
            <Divider />
            <StatLine label={left >= 0 ? 'Remaining' : 'Over'} value={fmt(Math.abs(left))} color={left >= 0 ? c.accent : c.warning} />
          </View>
        </Row>
        <Row gap={Space.sm}>
          <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color={c.protein} />
          <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color={c.carbs} />
          <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color={c.fat} />
          <MacroBar label="Fiber" value={totals.fiber} goal={goals.fiber} color={c.fiber} />
        </Row>
      </Card>

      {active.length > 0 && (
        <>
          <SectionHeader title="Eat from pantry" action={<T variant="caption" color={c.accent} onPress={() => router.navigate('/pantry')}>See all</T>} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm, paddingHorizontal: Space.lg }} style={{ marginHorizontal: -Space.lg }}>
            {active.map((b) => {
              const servingG = b.totalWeightG / b.servings;
              return (
                <Pressable key={b._id} onPress={() => router.push({ pathname: '/batch/[id]', params: { id: b._id, date } })} style={({ pressed }) => ({ width: 160, backgroundColor: c.card, borderRadius: Radius.lg, padding: Space.md, gap: 6, opacity: pressed ? 0.7 : 1, borderWidth: 0.5, borderColor: c.border })}>
                  <T numberOfLines={1} style={{ fontWeight: '700' }}>{b.name}</T>
                  <T variant="caption">{fmt(b.remainingG / servingG, 1)} servings · {fmtG(b.remainingG)}</T>
                  <RemainingBar remaining={b.remainingG} total={b.totalWeightG} />
                  <Row gap={4}>
                    <Ionicons name="add-circle" size={16} color={c.accent} />
                    <T variant="caption" color={c.accent} style={{ fontWeight: '700' }}>Eat</T>
                  </Row>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {MEALS.map((meal) => {
        const entries = (day.data?.entries ?? []).filter((e) => e.meal === meal);
        const mealCals = entries.reduce((s, e) => s + e.macros.calories, 0);
        return (
          <Card key={meal} style={{ paddingVertical: Space.md, gap: 2 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons name={MEAL_ICON[meal]} size={18} color={c.textSecondary} />
                <T variant="h3">{MEAL_LABEL[meal]}</T>
                {mealCals > 0 && <T variant="caption">{fmt(mealCals)} kcal</T>}
              </Row>
              <IconButton icon="add-circle" size={28} onPress={() => router.push({ pathname: '/add-food', params: { date, meal } })} />
            </Row>
            {entries.map((e) => (
              <ListRow
                key={e._id}
                title={e.name}
                subtitle={[e.grams ? fmtG(e.grams) : null, `P ${fmt(e.macros.protein)} · C ${fmt(e.macros.carbs)} · F ${fmt(e.macros.fat)} · Fb ${fmt(e.macros.fiber ?? 0)}`].filter(Boolean).join('  ·  ')}
                right={<T variant="number">{fmt(e.macros.calories)}</T>}
                onPress={() => entryActions(e)}
              />
            ))}
          </Card>
        );
      })}
      {day.error && <T color={c.danger}>{day.error}</T>}
      {totals.calories > 0 && (
        <View style={{ alignItems: 'center' }}>
          <MacroLine m={totals} />
        </View>
      )}
    </Screen>
  );
}

function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T muted>{label}</T>
      <T variant="number" color={color}>{value}</T>
    </Row>
  );
}
