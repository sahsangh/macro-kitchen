import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { Button, Card, Divider, Empty, IconButton, ListRow, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { prettyDate, shiftDate, today } from '@/lib/date';
import { minutesBetween, startWorkout, workoutSummary } from '@/lib/training';
import { useUnits } from '@/lib/units';
import { useFetch } from '@/lib/useFetch';
import type { BodyWeight, Routine, Workout } from '@/lib/types';

export default function TrainScreen() {
  const c = useTheme();
  const u = useUnits();
  const activeQ = useFetch<{ workout: Workout | null }>('/workouts/active');
  const routinesQ = useFetch<{ routines: Routine[] }>('/routines');
  const historyQ = useFetch<{ workouts: Workout[] }>('/workouts?limit=30');
  const weightsQ = useFetch<{ weights: BodyWeight[] }>(`/weights?from=${shiftDate(today(), -60)}`);
  const reload = () => [activeQ, routinesQ, historyQ, weightsQ].forEach((q) => q.reload());

  const active = activeQ.data?.workout;
  const done = (historyQ.data?.workouts ?? []).filter((w) => w.status === 'done');
  const weekStart = shiftDate(today(), -6);
  const thisWeek = done.filter((w) => w.date >= weekStart);
  const latestWeight = weightsQ.data?.weights.at(-1);
  const routines = routinesQ.data?.routines ?? [];

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={c.accent} />}>
      <Stack.Screen options={{ headerRight: () => <View style={{ paddingHorizontal: 12 }}><IconButton icon="add" size={28} onPress={() => router.push('/routine/edit')} /></View> }} />

      {active && (
        <Card onPress={() => router.push({ pathname: '/workout/[id]', params: { id: active._id } })} style={{ backgroundColor: c.accent, borderColor: c.accent }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T color={c.accentText} style={{ fontWeight: '800', fontSize: 17 }}>{active.name} in progress</T>
              <T color={c.accentText} style={{ opacity: 0.85 }}>{minutesBetween(active.startedAt)} min · tap to continue</T>
            </View>
            <Ionicons name="play-circle" size={36} color={c.accentText} />
          </Row>
        </Card>
      )}

      <Row gap={Space.sm}>
        <Button icon="barbell" title="Start workout" kind={active ? 'secondary' : 'primary'} onPress={() => startWorkout()} style={{ flex: 1 }} />
        <Button icon="walk" title="Log cardio" kind="secondary" onPress={() => router.push('/cardio')} style={{ flex: 1 }} />
      </Row>

      <Row gap={Space.sm}>
        <Stat label="This week" value={`${thisWeek.length}`} sub={thisWeek.length === 1 ? 'workout' : 'workouts'} />
        <Stat label="Burned" value={`${thisWeek.reduce((n, w) => n + w.caloriesBurned, 0)}`} sub="kcal, 7 days" />
        <Stat label="Weight" value={latestWeight ? u.w(latestWeight.weightKg) : '–'} sub={latestWeight ? u.unit : 'tap to log'} onPress={() => router.push('/weight')} />
      </Row>

      <SectionHeader title="Routines" action={<T variant="caption" color={c.accent} style={{ fontWeight: '700' }} onPress={() => router.push('/routine/edit')}>New</T>} />
      {routinesQ.data && routines.length === 0 && (
        <Card>
          <Empty icon="list" title="No routines yet" message="Save your usual days (Push, Pull, Legs…) and start them with one tap. Last time’s weights show up as you go." action={<Button small title="Create a routine" icon="add" onPress={() => router.push('/routine/edit')} style={{ marginTop: Space.sm }} />} />
        </Card>
      )}
      {routines.map((r) => (
        <Card key={r._id} style={{ gap: Space.sm }} onPress={() => router.push({ pathname: '/routine/edit', params: { id: r._id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="h3">{r.name}</T>
              <T variant="caption" numberOfLines={2}>{r.exercises.map((x) => x.name).join(' · ') || 'No exercises'}</T>
            </View>
            <Button small title="Start" icon="play" onPress={() => startWorkout(r._id)} />
          </Row>
        </Card>
      ))}

      <SectionHeader title="History" />
      {historyQ.data && done.length === 0 && <T muted>Finished workouts and cardio show up here.</T>}
      {done.length > 0 && (
        <Card style={{ paddingVertical: Space.xs }}>
          {done.map((w, i) => (
            <View key={w._id}>
              {i > 0 && <Divider />}
              <ListRow
                icon={w.entries.every((e) => e.kind === 'cardio') ? 'walk' : 'barbell'}
                title={w.name}
                subtitle={`${prettyDate(w.date)} · ${workoutSummary(w)}`}
                right={<Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w._id } })}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function Stat({ label, value, sub, onPress }: { label: string; value: string; sub: string; onPress?: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} style={{ flex: 1, padding: Space.md, gap: 2, borderRadius: Radius.md }}>
      <T variant="caption">{label}</T>
      <T variant="number" style={{ fontSize: 22 }}>{value}</T>
      <T variant="caption" color={c.textMuted}>{sub}</T>
    </Card>
  );
}
