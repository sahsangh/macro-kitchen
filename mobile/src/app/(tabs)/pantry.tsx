import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { MacroLine, RemainingBar } from '@/components/macros';
import { Button, Card, Empty, IconButton, Row, Screen, Segmented, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { relativeDays } from '@/lib/date';
import { fmt, fmtG, scale } from '@/lib/macros';
import { useFetch } from '@/lib/useFetch';
import type { Batch } from '@/lib/types';

export default function PantryScreen() {
  const c = useTheme();
  const [tab, setTab] = useState<'active' | 'finished' | 'discarded'>('active');
  const { data, reload, loading } = useFetch<{ batches: Batch[] }>(`/batches?status=${tab}`);
  const batches = data?.batches ?? [];

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={c.accent} />}>
      <Stack.Screen options={{ headerRight: () => <View style={{ paddingHorizontal: 12 }}><IconButton icon="add" size={28} onPress={() => router.push({ pathname: '/add-food', params: { mode: 'track' } })} /></View> }} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'finished', label: 'Finished' },
          { value: 'discarded', label: 'Thrown out' },
        ]}
      />
      {!loading && batches.length === 0 && tab === 'active' && (
        <Empty
          icon="file-tray-stacked"
          title="Nothing in the pantry"
          message="When you cook a recipe, it lands here so you can eat it down serving by serving. You can also track a tub of something you bought."
          action={<Button title="Track a food" icon="add" kind="secondary" onPress={() => router.push({ pathname: '/add-food', params: { mode: 'track' } })} style={{ marginTop: Space.sm }} />}
        />
      )}
      {!loading && batches.length === 0 && tab !== 'active' && <Empty icon="time" title="Nothing here yet" />}
      {batches.map((b) => {
        const servingG = b.totalWeightG / b.servings;
        const perServing = scale(b.totals, servingG / b.totalWeightG);
        const servingsLeft = b.remainingG / servingG;
        return (
          <Card key={b._id} onPress={() => router.push({ pathname: '/batch/[id]', params: { id: b._id } })} style={{ gap: Space.sm }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>{b.name}</T>
                <T variant="caption">Made {relativeDays(b.madeAt)}</T>
              </View>
              {b.status === 'active' && (
                <View style={{ alignItems: 'flex-end' }}>
                  <T variant="number" style={{ fontSize: 20 }}>{fmt(servingsLeft, 1)}</T>
                  <T variant="caption">serving{fmt(servingsLeft, 1) === '1' ? '' : 's'} left</T>
                </View>
              )}
            </Row>
            {b.status === 'active' && (
              <>
                <RemainingBar remaining={b.remainingG} total={b.totalWeightG} />
                <T variant="caption">{fmtG(b.remainingG)} of {fmtG(b.totalWeightG)} · {fmt((b.remainingG / b.totalWeightG) * 100)}% left · {fmt(servingG)} g / serving</T>
              </>
            )}
            <Row gap={6}>
              <T variant="caption" style={{ fontWeight: '600' }}>Per serving:</T>
              <MacroLine m={perServing} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
