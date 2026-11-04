import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Divider, ErrorText, Field, ListRow, Row, Screen, Segmented, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { post } from '@/lib/api';
import { exercisePicker } from '@/lib/exercisePicker';
import { useFetch } from '@/lib/useFetch';
import type { Exercise, ExerciseKind } from '@/lib/types';

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'] as const;

export default function ExercisePickerScreen() {
  const c = useTheme();
  const params = useLocalSearchParams<{ kind?: ExerciseKind; single?: string }>();
  const single = params.single === '1';
  const { data } = useFetch<{ exercises: Exercise[] }>(`/exercises${params.kind ? `?kind=${params.kind}` : ''}`);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<(typeof GROUPS)[number]>(params.kind === 'cardio' ? 'cardio' : 'all');
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [newKind, setNewKind] = useState<ExerciseKind>(params.kind ?? 'strength');
  const [newMuscle, setNewMuscle] = useState('other');
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const query = terms.join(' ');
    // Exact name, then names starting with the search, then everything else.
    const rank = (e: Exercise) => {
      const n = e.name.toLowerCase();
      return !query ? 0 : n === query ? 0 : n.startsWith(query) ? 1 : 2;
    };
    return (data?.exercises ?? [])
      .filter((e) => (group === 'all' || e.muscle === group) && terms.every((t) => e.name.toLowerCase().includes(t)))
      .sort((a, b) => rank(a) - rank(b));
  }, [data, q, group]);

  const finish = (chosen: Exercise[]) => {
    exercisePicker.deliver(chosen);
    router.back();
  };
  const toggle = (e: Exercise) => {
    if (single) return finish([e]);
    setPicked((p) => (p.some((x) => x._id === e._id) ? p.filter((x) => x._id !== e._id) : [...p, e]));
  };
  const create = async () => {
    try {
      const { exercise } = await post<{ exercise: Exercise }>('/exercises', { name: q.trim(), kind: newKind, muscle: newMuscle });
      if (single) finish([exercise]);
      else {
        setPicked((p) => [...p, exercise]);
        setQ('');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: params.kind === 'cardio' ? 'Choose activity' : 'Add exercises',
          headerLeft: () => <Button small kind="ghost" title="Cancel" onPress={() => router.back()} />,
          headerRight: () => (single ? null : <Button small kind="ghost" title={picked.length ? `Add (${picked.length})` : 'Add'} disabled={!picked.length} onPress={() => finish(picked)} />),
        }}
      />
      <Field value={q} onChangeText={setQ} placeholder="Search exercises" autoCorrect={false} clearButtonMode="while-editing" />
      {!params.kind && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Space.lg }} contentContainerStyle={{ gap: Space.sm, paddingHorizontal: Space.lg }}>
          {GROUPS.map((g) => (
            <Chip key={g} label={g === 'all' ? 'All' : g[0].toUpperCase() + g.slice(1)} active={g === group} onPress={() => setGroup(g)} />
          ))}
        </ScrollView>
      )}
      <Card style={{ paddingVertical: Space.xs }}>
        {list.map((e, i) => {
          const on = picked.some((x) => x._id === e._id);
          return (
            <View key={e._id}>
              {i > 0 && <Divider />}
              <ListRow
                title={e.name}
                subtitle={[e.kind === 'cardio' ? 'Cardio' : e.muscle && e.muscle[0].toUpperCase() + e.muscle.slice(1), e.equipment, e.createdBy ? 'Custom' : null].filter(Boolean).join(' · ')}
                right={single ? <Ionicons name="chevron-forward" size={18} color={c.textMuted} /> : <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? c.accent : c.textMuted} />}
                onPress={() => toggle(e)}
              />
            </View>
          );
        })}
        {data && list.length === 0 && <T muted style={{ paddingVertical: Space.md }}>No matches.</T>}
      </Card>
      {q.trim().length > 1 && (
        <Card style={{ gap: Space.md }}>
          <T style={{ fontWeight: '600' }}>Create “{q.trim()}”</T>
          {!params.kind && <Segmented value={newKind} onChange={setNewKind} options={[{ value: 'strength', label: 'Strength' }, { value: 'cardio', label: 'Cardio' }]} />}
          {newKind === 'strength' && (
            <Row gap={Space.sm} style={{ flexWrap: 'wrap' }}>
              {['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'other'].map((m) => (
                <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} active={m === newMuscle} onPress={() => setNewMuscle(m)} />
              ))}
            </Row>
          )}
          <ErrorText>{error}</ErrorText>
          <Button small icon="add" title="Create exercise" onPress={create} />
        </Card>
      )}
    </Screen>
  );
}
