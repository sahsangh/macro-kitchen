import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { Button, Card, ErrorText, Field, IconButton, Row, Screen, SectionHeader, T, success } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { del, get, post, put } from '@/lib/api';
import { exercisePicker } from '@/lib/exercisePicker';
import { startWorkout } from '@/lib/training';
import type { Exercise, Routine, RoutineExercise } from '@/lib/types';

export default function RoutineEditScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineExercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    get<{ routine: Routine }>(`/routines/${id}`).then(({ routine }) => {
      setName(routine.name);
      setItems(routine.exercises);
    }, (e) => setError(e.message));
  }, [id]);

  const add = () =>
    exercisePicker.open((picked: Exercise[]) =>
      setItems((xs) => [...xs, ...picked.map((e) => ({ exercise: e._id, name: e.name, kind: e.kind, sets: 3, reps: e.kind === 'cardio' ? '' : '8-12' }))]),
    );
  const set = (i: number, patch: Partial<RoutineExercise>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const copy = [...xs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const save = async (thenStart = false) => {
    setBusy(true);
    setError(null);
    try {
      const body = { name, exercises: items };
      const { routine } = id ? await put<{ routine: Routine }>(`/routines/${id}`, body) : await post<{ routine: Routine }>('/routines', body);
      success();
      router.back();
      if (thenStart) setTimeout(() => startWorkout(routine._id), 350);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete routine?', 'Past workouts are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/routines/${id}`); router.back(); } },
    ]);

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen
        options={{
          title: id ? 'Edit routine' : 'New routine',
          headerLeft: () => <Button small kind="ghost" title="Cancel" onPress={() => router.back()} />,
          headerRight: () => <Button small kind="ghost" title="Save" onPress={() => save()} disabled={!name.trim() || busy} />,
        }}
      />
      <Field placeholder="Routine name, e.g. Push Day" value={name} onChangeText={setName} style={{ fontSize: 20, fontWeight: '700' }} />
      <SectionHeader title={`Exercises (${items.length})`} />
      {items.map((x, i) => (
        <Card key={`${x.exercise}-${i}`} style={{ gap: Space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3" style={{ flex: 1 }}>{x.name}</T>
            <IconButton icon="chevron-up" color={c.textSecondary} onPress={() => move(i, -1)} />
            <IconButton icon="chevron-down" color={c.textSecondary} onPress={() => move(i, 1)} />
            <IconButton icon="remove-circle-outline" color={c.danger} onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} />
          </Row>
          {x.kind === 'strength' ? (
            <Row gap={Space.md}>
              <Row gap={6}>
                <T muted>Sets</T>
                <IconButton icon="remove-circle" onPress={() => set(i, { sets: Math.max(1, x.sets - 1) })} />
                <T variant="number" style={{ minWidth: 18, textAlign: 'center' }}>{x.sets}</T>
                <IconButton icon="add-circle" onPress={() => set(i, { sets: Math.min(20, x.sets + 1) })} />
              </Row>
              <Row gap={6} style={{ flex: 1 }}>
                <T muted>Reps</T>
                <TextInput
                  value={x.reps}
                  onChangeText={(reps) => set(i, { reps })}
                  placeholder="8-12"
                  placeholderTextColor={c.textMuted}
                  style={{ flex: 1, minWidth: 0, backgroundColor: c.cardAlt, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 10, color: c.text, fontWeight: '600' }}
                />
              </Row>
            </Row>
          ) : (
            <T variant="caption">Cardio: log time/distance during the workout</T>
          )}
        </Card>
      ))}
      <Button kind="secondary" icon="add" title="Add exercises" onPress={add} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save routine" onPress={() => save()} loading={busy} disabled={!name.trim()} />
      {items.length > 0 && <Button kind="ghost" icon="play" title="Save & start workout" onPress={() => save(true)} disabled={!name.trim() || busy} />}
      {id && <Button kind="ghost" title="Delete routine" onPress={remove} />}
      <View style={{ height: Space.lg }} />
    </Screen>
  );
}
