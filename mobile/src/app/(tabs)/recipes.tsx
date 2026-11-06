import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { MacroLine } from '@/components/macros';
import { Button, Card, Chip, Empty, ErrorText, Field, IconButton, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { post } from '@/lib/api';
import { fmt, fmtG, folderNames, scale } from '@/lib/macros';
import { recipeDraft } from '@/lib/recipeDraft';
import { useFetch } from '@/lib/useFetch';
import type { Recipe } from '@/lib/types';

function RecipeCard({ r }: { r: Recipe }) {
  return (
    <Card onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r._id } })} style={{ gap: 6 }}>
      <T variant="h3">{r.name}</T>
      <T variant="caption">
        {fmt(r.servings, 1)} servings · {fmtG(r.totalWeightG)} · {r.ingredients.length} ingredients{r.extras.length ? ` + ${r.extras.length} extras` : ''}
      </T>
      <Row gap={6}>
        <T variant="caption" style={{ fontWeight: '600' }}>Per serving:</T>
        <MacroLine m={scale(r.totals, 1 / r.servings)} />
      </Row>
    </Card>
  );
}

export default function RecipesScreen() {
  const c = useTheme();
  const { data, reload, loading } = useFetch<{ recipes: Recipe[] }>('/recipes');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = data?.recipes ?? [];
  const folders = folderNames(all);
  const active = selected && folders.includes(selected) ? selected : null;
  const search = q.trim().toLowerCase();
  // Searching looks through every folder.
  const recipes = search ? all.filter((r) => r.name.toLowerCase().includes(search)) : active ? all.filter((r) => r.folder === active) : all;
  const showFolderTools = !!active && !search;
  const grouped = folders.length > 0 && !showFolderTools;
  const unfiled = recipes.filter((r) => !r.folder);

  const newRecipe = () => {
    recipeDraft.reset();
    if (active) recipeDraft.set({ folder: active });
    router.push('/recipe/edit');
  };

  const pick = (folder: string | null) => {
    setSelected(folder);
    setRenaming(null);
    setError(null);
  };

  const renameFolder = async (to: string) => {
    setError(null);
    try {
      const { folder } = await post<{ folder: string }>('/recipes/folders/rename', { from: active, to });
      pick(folder || null);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeFolder = () =>
    Alert.alert(`Remove "${active}"?`, 'The recipes stay. They just won’t be in a folder anymore.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove folder', style: 'destructive', onPress: () => renameFolder('') },
    ]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={c.accent} />}>
      <Stack.Screen options={{ headerRight: () => <View style={{ paddingHorizontal: 12 }}><IconButton icon="add" size={28} onPress={newRecipe} /></View> }} />
      {all.length > 4 && <Field placeholder="Search recipes" value={q} onChangeText={setQ} clearButtonMode="while-editing" />}
      {folders.length > 0 && !search && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
          <Chip label="All" active={!active} onPress={() => pick(null)} />
          {folders.map((f) => <Chip key={f} label={`${f} · ${all.filter((r) => r.folder === f).length}`} active={active === f} onPress={() => pick(f)} />)}
        </ScrollView>
      )}
      {showFolderTools && (renaming === null ? (
        <Row gap={Space.sm}>
          <Button small kind="secondary" icon="pencil" title="Rename" onPress={() => setRenaming(active)} style={{ flex: 1 }} />
          <Button small kind="secondary" icon="folder-open-outline" title="Remove folder" onPress={removeFolder} style={{ flex: 1 }} />
        </Row>
      ) : (
        <Row gap={Space.sm}>
          <Field value={renaming} onChangeText={setRenaming} autoFocus maxLength={40} style={{ flex: 1 }} />
          <Button small title="Save" disabled={!renaming.trim()} onPress={() => renameFolder(renaming)} />
          <Button small kind="ghost" title="Cancel" onPress={() => setRenaming(null)} />
        </Row>
      ))}
      <ErrorText>{error}</ErrorText>
      {!loading && data?.recipes.length === 0 && (
        <Empty
          icon="book"
          title="No recipes yet"
          message="Save what you cook at home with every ingredient, the total weight and number of servings."
          action={<Button title="New recipe" icon="add" onPress={newRecipe} style={{ marginTop: Space.sm }} />}
        />
      )}
      {grouped ? (
        <>
          {folders.map((f) => {
            const inFolder = recipes.filter((r) => r.folder === f);
            if (!inFolder.length) return null;
            return (
              <View key={f} style={{ gap: Space.md }}>
                <SectionHeader title={f} />
                {inFolder.map((r) => <RecipeCard key={r._id} r={r} />)}
              </View>
            );
          })}
          {unfiled.length > 0 && (
            <View style={{ gap: Space.md }}>
              <SectionHeader title="No folder" />
              {unfiled.map((r) => <RecipeCard key={r._id} r={r} />)}
            </View>
          )}
        </>
      ) : (
        recipes.map((r) => <RecipeCard key={r._id} r={r} />)
      )}
    </Screen>
  );
}
