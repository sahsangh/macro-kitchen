import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Card, Divider, Field, ListRow, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { get } from '@/lib/api';
import { flowParams, useFlowParams } from '@/lib/flow';
import { fmt, fmtG } from '@/lib/macros';
import { useFetch } from '@/lib/useFetch';
import type { Batch, Food } from '@/lib/types';

const SOURCE_LABEL = { usda: 'USDA', off: 'Open Food Facts', custom: 'My food' };

export default function AddFoodScreen() {
  const c = useTheme();
  const flow = useFlowParams();
  const params = flowParams(flow);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [fetchedOnline, setFetchedOnline] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useFetch<{ foods: Food[] }>('/foods/recent');
  const pantry = useFetch<{ batches: Batch[] }>(flow.mode === 'log' ? '/batches' : null);
  const seq = useRef(0);

  const search = async (query: string, online = false) => {
    const id = ++seq.current;
    setSearching(true);
    setError(null);
    try {
      const r = await get<{ foods: Food[]; fetchedOnline: boolean }>(`/foods/search?q=${encodeURIComponent(query)}${online ? '&online=1' : ''}`);
      if (id !== seq.current) return;
      setResults(r.foods);
      setFetchedOnline(r.fetchedOnline);
    } catch (e: any) {
      if (id === seq.current) setError(e.message);
    } finally {
      if (id === seq.current) setSearching(false);
    }
  };

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      seq.current++; // drop any in-flight search
      return;
    }
    const t = setTimeout(() => search(query), 350);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().length >= 2 ? results : null;
  const open = (f: Food) => router.push({ pathname: '/food/[id]', params: { id: f._id, ...params } });
  const title = { log: 'Add food', ingredient: 'Add ingredient', track: 'Track a food' }[flow.mode];
  const pantryItems = pantry.data?.batches ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Row gap={Space.sm}>
        <View style={{ flex: 1 }}>
          <Field value={q} onChangeText={setQ} placeholder="Search foods, e.g. greek yogurt" autoFocus autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" onSubmitEditing={() => q.trim().length >= 2 && search(q.trim())} />
        </View>
        <Pressable onPress={() => router.push({ pathname: '/scan', params })} style={({ pressed }) => ({ backgroundColor: c.accent, borderRadius: Radius.md, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="barcode-outline" size={26} color={c.accentText} />
        </Pressable>
      </Row>

      {shown === null ? (
        <>
          <Row gap={Space.sm}>
            {flow.mode === 'log' && <Button small kind="secondary" icon="flash" title="Quick add" onPress={() => router.push({ pathname: '/quick-add', params })} style={{ flex: 1 }} />}
            <Button small kind="secondary" icon="create" title="Custom food" onPress={() => router.push({ pathname: '/custom-food', params })} style={{ flex: 1 }} />
          </Row>

          {pantryItems.length > 0 && (
            <>
              <SectionHeader title="From your pantry" />
              <Card style={{ paddingVertical: Space.xs }}>
                {pantryItems.map((b, i) => (
                  <View key={b._id}>
                    {i > 0 && <Divider />}
                    <ListRow
                      icon="file-tray-stacked"
                      title={b.name}
                      subtitle={`${fmt(b.remainingG / (b.totalWeightG / b.servings), 1)} servings left · ${fmtG(b.remainingG)}`}
                      right={<Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
                      onPress={() => router.push({ pathname: '/batch/[id]', params: { id: b._id, ...params } })}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}

          {(recent.data?.foods.length ?? 0) > 0 && (
            <>
              <SectionHeader title="Recent" />
              <FoodList foods={recent.data!.foods} onPress={open} />
            </>
          )}
        </>
      ) : (
        <>
          {error && <T color={c.danger}>{error}</T>}
          {shown.length > 0 && <FoodList foods={shown} onPress={open} />}
          {searching ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: Space.lg }} />
          ) : (
            <View style={{ gap: Space.sm, alignItems: 'center' }}>
              {shown.length === 0 && <T muted>No matches.</T>}
              {!fetchedOnline && <Button kind="ghost" icon="globe-outline" title="Search online for more" onPress={() => search(q.trim(), true)} />}
              <Button kind="ghost" icon="create-outline" title={`Create "${q.trim()}" as a custom food`} onPress={() => router.push({ pathname: '/custom-food', params: { ...params, name: q.trim() } })} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function FoodList({ foods, onPress }: { foods: Food[]; onPress: (f: Food) => void }) {
  const c = useTheme();
  return (
    <Card style={{ paddingVertical: Space.xs }}>
      {foods.map((f, i) => (
        <View key={f._id}>
          {i > 0 && <Divider />}
          <ListRow
            title={f.name}
            titleLines={2}
            subtitle={[f.brand, `${fmt(f.per100g.calories)} kcal/100g`, `P ${fmt(f.per100g.protein)}`, SOURCE_LABEL[f.source]].filter(Boolean).join(' · ')}
            right={<Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
            onPress={() => onPress(f)}
          />
        </View>
      ))}
    </Card>
  );
}
