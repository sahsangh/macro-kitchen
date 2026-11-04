import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ErrorText, Field, IconButton, Loading, Row, Screen, T, success, tap } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { del, get, post, put } from '@/lib/api';
import { prettyDate } from '@/lib/date';
import { exercisePicker } from '@/lib/exercisePicker';
import { useUnits } from '@/lib/units';
import type { Exercise, Previous, Workout, WorkoutEntry } from '@/lib/types';

/** Local, editable copy of a workout: numbers kept as the text being typed. */
type LSet = { w: string; r: string; done: boolean };
type LEntry = Omit<WorkoutEntry, 'sets'> & { sets: LSet[]; dur: string; dist: string; cal: string };

const DEFAULT_REST_S = 90;
const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};
/** Wall clock for event handlers (render code uses the ticking `now` state). */
const clock = () => Date.now();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function WorkoutScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const u = useUnits();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [entries, setEntries] = useState<LEntry[]>([]);
  const [previous, setPrevious] = useState<Previous>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restEnd, setRestEndState] = useState<number | null>(null);
  const [restLength, setRestLength] = useState(DEFAULT_REST_S);
  const [now, setNow] = useState(clock);
  const restRef = useRef<number | null>(null);
  const loaded = useRef(false);
  const dirty = useRef(false);

  const toLocal = useCallback(
    (e: WorkoutEntry): LEntry => ({
      ...e,
      sets: (e.sets ?? []).map((s) => ({ w: u.w(s.weightKg), r: s.reps === undefined || s.reps === null ? '' : String(s.reps), done: s.done })),
      dur: e.durationMin ? String(e.durationMin) : '',
      dist: e.distanceKm ? String(Math.round(u.kmToDisplay(e.distanceKm) * 100) / 100) : '',
      cal: e.caloriesManual && e.calories !== undefined ? String(Math.round(e.calories)) : '',
    }),
    [u],
  );
  const toServer = (e: LEntry): WorkoutEntry => ({
    exercise: e.exercise,
    name: e.name,
    kind: e.kind,
    targetReps: e.targetReps,
    ...(e.kind === 'strength'
      ? { sets: e.sets.map((s) => ({ weightKg: num(s.w) !== undefined ? u.toKg(num(s.w)!) : undefined, reps: num(s.r), done: s.done })) }
      : {
          durationMin: num(e.dur),
          distanceKm: num(e.dist) !== undefined ? u.displayToKm(num(e.dist)!) : undefined,
          calories: num(e.cal),
          caloriesManual: num(e.cal) !== undefined,
        }),
  });

  const loadPrevious = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { previous: p } = await get<{ previous: Previous }>(`/workouts/previous?exercises=${ids.join(',')}`);
    setPrevious((old) => ({ ...old, ...p }));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { workout: w } = await get<{ workout: Workout }>(`/workouts/${id}`);
        setWorkout(w);
        setEntries(w.entries.map(toLocal));
        loaded.current = true;
        loadPrevious(w.entries.map((e) => e.exercise));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRestEnd = useCallback((v: number | null) => {
    restRef.current = v;
    setRestEndState(v);
  }, []);

  // One clock drives the elapsed time and the rest timer.
  useEffect(() => {
    const t = setInterval(() => {
      const n = clock();
      setNow(n);
      if (restRef.current && n >= restRef.current) {
        setRestEnd(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(t);
  }, [setRestEnd]);

  // Autosave a moment after any change, so nothing is lost if the app closes.
  useEffect(() => {
    if (!loaded.current || !dirty.current) return;
    const t = setTimeout(async () => {
      try {
        const { workout: w } = await put<{ workout: Workout }>(`/workouts/${id}`, { entries: entries.map(toServer) });
        dirty.current = false;
        setWorkout(w); // calories estimates; local inputs stay as typed
      } catch {
        // retried on the next edit / finish
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (fn: (draft: LEntry[]) => LEntry[]) => {
    dirty.current = true;
    setEntries((old) => fn(old));
  };
  const setSet = (ei: number, si: number, patch: Partial<LSet>) =>
    update((es) => es.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));
  const setEntry = (ei: number, patch: Partial<LEntry>) => update((es) => es.map((e, i) => (i === ei ? { ...e, ...patch } : e)));

  /**
   * What to suggest for a set: what you typed in the set above, else the same
   * set last time, else whatever the set above would suggest.
   */
  const hint = (e: LEntry, si: number): { w: string; r: string } => {
    const prevSets = previous[e.exercise]?.sets ?? [];
    const last = prevSets[si];
    const above = si > 0 ? e.sets[si - 1] : undefined;
    const fallback = si > 0 ? hint(e, si - 1) : { w: '', r: '' };
    return {
      w: above?.w || (last ? u.w(last.weightKg) : '') || fallback.w,
      r: above?.r || (last?.reps !== undefined ? String(last.reps) : '') || fallback.r,
    };
  };

  const toggleDone = (ei: number, si: number) => {
    const e = entries[ei];
    const s = e.sets[si];
    if (!s.done) {
      const h = hint(e, si);
      setSet(ei, si, { done: true, w: s.w || h.w, r: s.r || h.r });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (workout?.status === 'active') setRestEnd(clock() + restLength * 1000);
    } else {
      tap();
      setSet(ei, si, { done: false });
    }
  };

  const addSet = (ei: number) => update((es) => es.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, { w: '', r: '', done: false }] })));
  const removeSet = (ei: number, si: number) => update((es) => es.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })));
  const removeEntry = (ei: number) => update((es) => es.filter((_, i) => i !== ei));
  const addExercises = () =>
    exercisePicker.open((picked: Exercise[]) => {
      update((es) => [
        ...es,
        ...picked.map((x) => toLocal({ exercise: x._id, name: x.name, kind: x.kind, sets: x.kind === 'strength' ? [{ done: false }, { done: false }, { done: false }] : undefined })),
      ]);
      loadPrevious(picked.map((x) => x._id));
    });

  const entryMenu = (ei: number) => {
    const e = entries[ei];
    const options = ['Exercise history', 'Remove exercise', 'Cancel'];
    const act = (i: number) => {
      if (i === 0) router.push({ pathname: '/exercise/[id]', params: { id: e.exercise } });
      if (i === 1) removeEntry(ei);
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ title: e.name, options, destructiveButtonIndex: 1, cancelButtonIndex: 2 }, act);
    else Alert.alert(e.name, undefined, [{ text: options[0], onPress: () => act(0) }, { text: options[1], style: 'destructive', onPress: () => act(1) }, { text: 'Cancel', style: 'cancel' }]);
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const { workout: w } = await post<{ workout: Workout }>(`/workouts/${id}/finish`, { entries: entries.map(toServer) });
      success();
      router.back();
      setTimeout(() => Alert.alert('Workout saved 💪', `${w.name} · about ${w.caloriesBurned} kcal burned`), 400);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };
  const confirmFinish = () => {
    const unchecked = entries.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    if (!unchecked) return finish();
    Alert.alert('Finish workout?', `${unchecked} unchecked set${unchecked === 1 ? '' : 's'} won’t be saved.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  };
  const saveDone = async () => {
    setSaving(true);
    try {
      await put(`/workouts/${id}`, { entries: entries.map(toServer) });
      success();
      router.back();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };
  const discard = () =>
    Alert.alert(workout?.status === 'active' ? 'Discard workout?' : 'Delete workout?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: workout?.status === 'active' ? 'Discard' : 'Delete', style: 'destructive', onPress: async () => { await del(`/workouts/${id}`); router.back(); } },
    ]);

  if (error && !workout) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!workout) return <Loading />;
  const active = workout.status === 'active';
  const elapsed = Math.max(0, (now - new Date(workout.startedAt).getTime()) / 1000);
  const restLeft = restEnd ? Math.max(0, (restEnd - now) / 1000) : 0;
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: workout.name,
          headerRight: () => (active ? <Button small title="Finish" onPress={confirmFinish} loading={saving} /> : <Button small kind="ghost" title="Save" onPress={saveDone} loading={saving} />),
        }}
      />
      <Screen automaticallyAdjustKeyboardInsets contentStyle={{ paddingBottom: restEnd ? 140 : 60 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>{active ? `${mmss(elapsed)} elapsed` : prettyDate(workout.date)} · {doneSets} set{doneSets === 1 ? '' : 's'} done</T>
          <T variant="caption">≈ {workout.caloriesBurned} kcal</T>
        </Row>

        {entries.map((e, ei) => (
          <Card key={`${e.exercise}-${ei}`} style={{ gap: Space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exercise } })}>
                <T variant="h3" color={c.accent}>{e.name}</T>
                {e.targetReps && e.kind === 'strength' ? <T variant="caption">Target: {e.sets.length} × {e.targetReps}</T> : null}
              </Pressable>
              <IconButton icon="ellipsis-horizontal" color={c.textSecondary} onPress={() => entryMenu(ei)} />
            </Row>

            {e.kind === 'strength' ? (
              <>
                <Row gap={Space.sm}>
                  <T variant="caption" style={{ width: 26 }}>SET</T>
                  <T variant="caption" style={{ flex: 1 }}>PREVIOUS</T>
                  <T variant="caption" style={{ width: 64, textAlign: 'center' }}>{u.unit.toUpperCase()}</T>
                  <T variant="caption" style={{ width: 56, textAlign: 'center' }}>REPS</T>
                  <View style={{ width: 34 }} />
                </Row>
                {e.sets.map((s, si) => {
                  const prev = previous[e.exercise]?.sets[si];
                  const h = hint(e, si);
                  return (
                    <Row key={si} gap={Space.sm} style={{ backgroundColor: s.done ? c.accentSoft : 'transparent', borderRadius: Radius.sm, marginHorizontal: -6, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Pressable style={{ width: 26 }} onLongPress={() => removeSet(ei, si)} onPress={() => Alert.alert(`Set ${si + 1}`, undefined, [{ text: 'Delete set', style: 'destructive', onPress: () => removeSet(ei, si) }, { text: 'Cancel', style: 'cancel' }])}>
                        <T style={{ fontWeight: '700' }}>{si + 1}</T>
                      </Pressable>
                      <T variant="caption" style={{ flex: 1 }} numberOfLines={1}>{prev ? `${u.w(prev.weightKg) || 0} × ${prev.reps ?? 0}` : '—'}</T>
                      <SetInput value={s.w} placeholder={h.w} onChange={(w) => setSet(ei, si, { w })} width={64} />
                      <SetInput value={s.r} placeholder={h.r} onChange={(r) => setSet(ei, si, { r })} width={56} integer />
                      <Pressable onPress={() => toggleDone(ei, si)} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? c.accent : c.cardAlt }}>
                        <Ionicons name="checkmark" size={20} color={s.done ? c.accentText : c.textMuted} />
                      </Pressable>
                    </Row>
                  );
                })}
                <Button small kind="secondary" icon="add" title="Add set" onPress={() => addSet(ei)} />
              </>
            ) : (
              <>
                <Row gap={Space.sm}>
                  <Field label="Minutes" value={e.dur} onChangeText={(dur) => setEntry(ei, { dur })} keyboardType="decimal-pad" style={{ flex: 1 }} />
                  <Field label={`Distance (${u.dist})`} value={e.dist} onChangeText={(dist) => setEntry(ei, { dist })} keyboardType="decimal-pad" placeholder="optional" style={{ flex: 1 }} />
                  <Field
                    label="kcal"
                    value={e.cal}
                    onChangeText={(cal) => setEntry(ei, { cal })}
                    keyboardType="number-pad"
                    placeholder={String(Math.round(workout.entries.find((x) => x.exercise === e.exercise)?.calories ?? 0) || 'auto')}
                    style={{ flex: 1 }}
                  />
                </Row>
                {previous[e.exercise] && (
                  <T variant="caption">
                    Last time: {previous[e.exercise].durationMin ?? 0} min{previous[e.exercise].distanceKm ? ` · ${u.dU(previous[e.exercise].distanceKm)}` : ''}
                  </T>
                )}
              </>
            )}
          </Card>
        ))}

        <Button icon="add" kind="secondary" title="Add exercise" onPress={addExercises} />
        <ErrorText>{error}</ErrorText>
        {active ? <Button title="Finish workout" onPress={confirmFinish} loading={saving} disabled={!doneSets && !entries.some((e) => e.kind === 'cardio')} /> : null}
        <Button kind="ghost" title={active ? 'Discard workout' : 'Delete workout'} onPress={discard} style={{ marginTop: -Space.sm }} />
      </Screen>

      {restEnd && (
        <View style={{ position: 'absolute', left: Space.lg, right: Space.lg, bottom: insets.bottom + Space.md, backgroundColor: c.card, borderRadius: Radius.lg, padding: Space.md, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <T variant="caption">Rest</T>
              <T variant="number" style={{ fontSize: 28 }}>{mmss(restLeft)}</T>
            </View>
            <Row gap={Space.sm}>
              <Button small kind="secondary" title="−15" onPress={() => { setRestEnd(restEnd - 15000); setRestLength((l) => Math.max(15, l - 15)); }} />
              <Button small kind="secondary" title="+15" onPress={() => { setRestEnd(restEnd + 15000); setRestLength((l) => l + 15); }} />
              <Button small title="Skip" onPress={() => setRestEnd(null)} />
            </Row>
          </Row>
        </View>
      )}
    </View>
  );
}

function SetInput({ value, placeholder, onChange, width, integer }: { value: string; placeholder?: string; onChange: (v: string) => void; width: number; integer?: boolean }) {
  const c = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder || '0'}
      placeholderTextColor={c.textMuted}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      selectTextOnFocus
      style={{ width, minWidth: 0, textAlign: 'center', backgroundColor: c.cardAlt, borderRadius: 8, paddingVertical: 7, color: c.text, fontWeight: '700', fontSize: 16 }}
    />
  );
}
