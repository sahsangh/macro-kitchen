import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LineChart } from '@/components/LineChart';
import { Card, Divider, ErrorText, ListRow, Loading, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { prettyDate } from '@/lib/date';
import { useUnits } from '@/lib/units';
import { useFetch } from '@/lib/useFetch';
import type { Exercise, WorkoutSet } from '@/lib/types';

type Session = { workoutId: string; date: string; sets: WorkoutSet[]; durationMin?: number; distanceKm?: number; calories?: number; bestOneRepMax: number; volumeKg: number };
type History = { exercise: Exercise; sessions: Session[]; bests: { heaviest: WorkoutSet | null; oneRepMax: number; mostReps: number } };

const toTime = (d: string) => new Date(`${d}T12:00:00`).getTime();

export default function ExerciseHistoryScreen() {
  const c = useTheme();
  const u = useUnits();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useFetch<History>(`/exercises/${id}/history`);
  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading />;
  const { exercise, sessions, bests } = data;
  const cardio = exercise.kind === 'cardio';
  const chrono = [...sessions].reverse();
  const points = cardio
    ? chrono.filter((s) => s.durationMin).map((s) => ({ x: toTime(s.date), y: s.durationMin! }))
    : chrono.filter((s) => s.bestOneRepMax > 0).map((s) => ({ x: toTime(s.date), y: u.toDisplay(s.bestOneRepMax) }));

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      {sessions.length === 0 ? (
        <T muted>No finished sessions yet. Your history and personal bests will show up here.</T>
      ) : (
        <>
          {!cardio && (
            <Row gap={Space.sm}>
              <Best label="Heaviest" value={bests.heaviest ? `${u.w(bests.heaviest.weightKg)}` : '–'} sub={bests.heaviest ? `${u.unit} × ${bests.heaviest.reps}` : ''} />
              <Best label="Est. 1RM" value={u.w(bests.oneRepMax)} sub={u.unit} />
              <Best label="Most reps" value={String(bests.mostReps)} sub="in a set" />
            </Row>
          )}
          {points.length >= 2 && (
            <Card style={{ gap: Space.sm }}>
              <T variant="label">{cardio ? 'Minutes per session' : `Estimated 1-rep max (${u.unit})`}</T>
              <LineChart points={points} color={c.protein} />
            </Card>
          )}
          <SectionHeader title={`Sessions (${sessions.length})`} />
          <Card style={{ paddingVertical: Space.xs }}>
            {sessions.map((s, i) => (
              <View key={s.workoutId}>
                {i > 0 && <Divider />}
                <ListRow
                  title={prettyDate(s.date)}
                  subtitle={
                    cardio
                      ? [s.durationMin ? `${s.durationMin} min` : '', u.dU(s.distanceKm), s.calories ? `${Math.round(s.calories)} kcal` : ''].filter(Boolean).join(' · ')
                      : s.sets.map((x) => `${u.w(x.weightKg) || 0}×${x.reps ?? 0}`).join(', ')
                  }
                  right={!cardio ? <T variant="caption">1RM {u.w(s.bestOneRepMax)}</T> : undefined}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: s.workoutId } })}
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Best({ label, value, sub }: { label: string; value: string; sub: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: Radius.md, padding: Space.md, gap: 2, borderWidth: 0.5, borderColor: c.border }}>
      <T variant="caption">{label}</T>
      <T variant="number" style={{ fontSize: 22 }}>{value}</T>
      <T variant="caption" color={c.textMuted}>{sub}</T>
    </View>
  );
}
