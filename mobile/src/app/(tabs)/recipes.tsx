import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { MacroLine } from '@/components/macros';
import { Card, Empty, Field, IconButton, Row, Screen, T, Button } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { fmt, fmtG, scale } from '@/lib/macros';
import { recipeDraft } from '@/lib/recipeDraft';
import { useFetch } from '@/lib/useFetch';
import type { Recipe } from '@/lib/types';

export default function RecipesScreen() {
  const c = useTheme();
  const { data, reload, loading } = useFetch<{ recipes: Recipe[] }>('/recipes');
  const [q, setQ] = useState('');
  const recipes = (data?.recipes ?? []).filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));

  const newRecipe = () => {
    recipeDraft.reset();
    router.push('/recipe/edit');
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={c.accent} />}>
      <Stack.Screen options={{ headerRight: () => <View style={{ paddingHorizontal: 12 }}><IconButton icon="add" size={28} onPress={newRecipe} /></View> }} />
      {(data?.recipes.length ?? 0) > 4 && <Field placeholder="Search recipes" value={q} onChangeText={setQ} clearButtonMode="while-editing" />}
      {!loading && data?.recipes.length === 0 && (
        <Empty
          icon="book"
          title="No recipes yet"
          message="Save what you cook at home with every ingredient, the total weight and number of servings."
          action={<Button title="New recipe" icon="add" onPress={newRecipe} style={{ marginTop: Space.sm }} />}
        />
      )}
      {recipes.map((r) => (
        <Card key={r._id} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r._id } })} style={{ gap: 6 }}>
          <T variant="h3">{r.name}</T>
          <T variant="caption">
            {fmt(r.servings, 1)} servings · {fmtG(r.totalWeightG)} · {r.ingredients.length} ingredients{r.extras.length ? ` + ${r.extras.length} extras` : ''}
          </T>
          <Row gap={6}>
            <T variant="caption" style={{ fontWeight: '600' }}>Per serving:</T>
            <MacroLine m={scale(r.totals, 1 / r.servings)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
