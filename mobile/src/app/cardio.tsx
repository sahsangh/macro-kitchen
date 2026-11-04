import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { Button, Card, Chip, ErrorText, Field, Row, Screen, SectionHeader, Segmented, T, success } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { post } from '@/lib/api';
import { prettyDate, shiftDate, today } from '@/lib/date';
import { exercisePicker } from '@/lib/exercisePicker';
import { useUnits } from '@/lib/units';
import { useFetch } from '@/lib/useFetch';
import type { BodyWeight, Exercise } from '@/lib/types';

const COMMON = ['Running', 'Walking', 'Cycling', 'Stationary Bike', 'Elliptical', 'Incline Treadmill Walk', 'Rowing Machine', 'Stair Climber', 'Swimming'];
const DEFAULT_KG = 70;

/** Log a cardio session that's already done (a run, a walk, a class…). */
export default function CardioScreen() {
  const c = useTheme();
  const u = useUnits();
  const params = useLocalSearchParams<{ date?: string }>();
  const exercisesQ = useFetch<{ exercises: Exercise[] }>('/exercises?kind=cardio');
  const weightQ = useFetch<{ weights: BodyWeight[] }>(`/weights?from=${shiftDate(today(), -365)}`);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [date, setDate] = useState(params.date ?? today());
  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = exercisesQ.data?.exercises ?? [];
  const common = COMMON.map((n) => all.find((e) => e.name === n)).filter(Boolean) as Exercise[];
  const choices = exercise && !common.some((e) => e._id === exercise._id) ? [exercise, ...common] : common;
  const kg = weightQ.data?.weights.at(-1)?.weightKg;

  // Same formula as the server, for a live preview.
  const estimate = useMemo(() => {
    if (!exercise) return 0;
    const body = kg ?? DEFAULT_KG;
    const km = Number(distance) > 0 ? u.displayToKm(Number(distance)) : 0;
    if (exercise.kcalPerKgKm && km) return body * km * exercise.kcalPerKgKm;
    if (exercise.met && Number(minutes) > 0) return (exercise.met * body * Number(minutes)) / 60;
    return 0;
  }, [exercise, minutes, distance, kg, u]);

  const save = async () => {
    if (!exercise) return;
    setBusy(true);
    setError(null);
    try {
      await post('/workouts', {
        date,
        finish: true,
        name: exercise.name,
        entries: [{
          exercise: exercise._id,
          durationMin: Number(minutes) || undefined,
          distanceKm: Number(distance) > 0 ? u.displayToKm(Number(distance)) : undefined,
          calories: Number(calories) || undefined,
          caloriesManual: Number(calories) > 0,
        }],
      });
      success();
      router.back();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const dateOptions = [today(), shiftDate(today(), -1), ...(params.date && ![today(), shiftDate(today(), -1)].includes(params.date) ? [params.date] : [])];

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <SectionHeader title="Activity" />
      <Row gap={Space.sm} style={{ flexWrap: 'wrap' }}>
        {choices.map((e) => (
          <Chip key={e._id} label={e.name} active={exercise?._id === e._id} onPress={() => setExercise(e)} />
        ))}
        <Chip label="More…" onPress={() => exercisePicker.open(([e]) => setExercise(e), { kind: 'cardio', single: true })} />
      </Row>

      {exercise && (
        <Card style={{ gap: Space.md }}>
          <Row gap={Space.sm}>
            <Field label="Minutes" value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" style={{ flex: 1 }} autoFocus />
            <Field label={`Distance (${u.dist})`} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="optional" style={{ flex: 1 }} />
          </Row>
          <Field
            label="Calories burned"
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            placeholder={estimate ? `≈ ${Math.round(estimate)} (estimate)` : 'enter time to estimate'}
            hint={
              exercise.kcalPerKgKm
                ? 'Distance gives the most accurate estimate. Type a number from your watch to override.'
                : 'Estimated from time and intensity. Type a number from your watch to override.'
            }
          />
          {!kg && <T variant="caption" color={c.warning}>Log your body weight (Train → Weight) for better estimates. Using {u.wU(DEFAULT_KG)} for now.</T>}
          <Segmented value={date} onChange={setDate} options={dateOptions.map((d) => ({ value: d, label: prettyDate(d) }))} />
          <ErrorText>{error}</ErrorText>
          <Button title="Save" icon="checkmark" onPress={save} loading={busy} disabled={!(Number(minutes) > 0 || Number(distance) > 0 || Number(calories) > 0)} />
        </Card>
      )}
    </Screen>
  );
}
