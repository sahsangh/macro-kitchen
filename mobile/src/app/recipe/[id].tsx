import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { MacroGrid, MacroLine } from '@/components/macros';
import { Button, Card, Divider, ErrorText, IconButton, ListRow, Loading, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { del } from '@/lib/api';
import { fmt, fmtG, per100, scale } from '@/lib/macros';
import { recipeDraft } from '@/lib/recipeDraft';
import { useFetch } from '@/lib/useFetch';
import type { Recipe } from '@/lib/types';

export default function RecipeScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useFetch<{ recipe: Recipe }>(`/recipes/${id}`);
  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading />;
  const r = data.recipe;
  const servingG = r.totalWeightG / r.servings;

  const edit = () => {
    recipeDraft.reset(r);
    router.push('/recipe/edit');
  };
  const remove = () =>
    Alert.alert('Delete recipe?', 'Pantry items you already made from it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/recipes/${r._id}`); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <Row gap={16}><IconButton icon="create-outline" onPress={edit} /><IconButton icon="trash-outline" color={c.danger} onPress={remove} /></Row> }} />
      <View style={{ gap: 4 }}>
        <T variant="title">{r.name}</T>
        <T muted>{fmt(r.servings, 1)} servings · {fmtG(r.totalWeightG)} total · {fmtG(servingG)} per serving</T>
      </View>
      <Button title="I made this" icon="restaurant" onPress={() => router.push({ pathname: '/recipe/cook', params: { id: r._id } })} />

      <SectionHeader title="Per serving" />
      <MacroGrid m={scale(r.totals, 1 / r.servings)} />
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}><T muted>Total</T><MacroLine m={r.totals} /></Row>
        <Row style={{ justifyContent: 'space-between' }}><T muted>Per 100 g</T><MacroLine m={scale(r.totals, 100 / r.totalWeightG)} /></Row>
      </Card>

      <SectionHeader title={`Ingredients (${r.ingredients.length})`} />
      <Card style={{ paddingVertical: Space.xs }}>
        {r.ingredients.map((ing, i) => (
          <View key={ing._id ?? i}>
            {i > 0 && <Divider />}
            <ListRow title={ing.name} subtitle={`${fmt(per100(ing.per100g, ing.grams).calories)} kcal · P ${fmt(per100(ing.per100g, ing.grams).protein)}g`} right={<T variant="number">{fmtG(ing.grams)}</T>} />
          </View>
        ))}
      </Card>

      {r.extras.length > 0 && (
        <>
          <SectionHeader title="Extras (no macros)" />
          <Card style={{ paddingVertical: Space.xs }}>
            {r.extras.map((x, i) => (
              <View key={x._id ?? i}>
                {i > 0 && <Divider />}
                <ListRow title={x.name} right={<T muted>{x.amount}</T>} />
              </View>
            ))}
          </Card>
        </>
      )}

      {r.notes ? (
        <>
          <SectionHeader title="Notes" />
          <Card><T>{r.notes}</T></Card>
        </>
      ) : null}
    </Screen>
  );
}
