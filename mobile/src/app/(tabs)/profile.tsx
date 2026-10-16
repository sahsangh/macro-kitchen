import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button, Card, Divider, ListRow, Screen, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/macros';

export default function ProfileScreen() {
  const c = useTheme();
  const { user, signOut, serverUrl } = useAuth();
  const g = user!.goals;
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: Space.md }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="title" color={c.accent}>{user!.name.slice(0, 1).toUpperCase()}</T>
        </View>
        <T variant="h2">{user!.name}</T>
        <T muted>@{user!.username}</T>
      </View>
      <Card style={{ paddingVertical: Space.sm }}>
        <ListRow icon="flame" title="Calories" right={<T variant="number">{fmt(g.calories)} kcal</T>} onPress={() => router.push('/goals')} />
        <Divider />
        <ListRow icon="barbell" title="Protein" right={<T variant="number">{fmt(g.protein)} g</T>} onPress={() => router.push('/goals')} />
        <Divider />
        <ListRow icon="leaf" title="Carbs" right={<T variant="number">{fmt(g.carbs)} g</T>} onPress={() => router.push('/goals')} />
        <Divider />
        <ListRow icon="water" title="Fat" right={<T variant="number">{fmt(g.fat)} g</T>} onPress={() => router.push('/goals')} />
        <Divider />
        <ListRow icon="git-branch" title="Fiber" right={<T variant="number">{fmt(g.fiber)} g</T>} onPress={() => router.push('/goals')} />
      </Card>
      <Button title="Edit goals" kind="secondary" icon="create-outline" onPress={() => router.push('/goals')} />
      <Button
        title="Sign out"
        kind="danger"
        icon="log-out-outline"
        onPress={() => Alert.alert('Sign out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])}
      />
      <View style={{ backgroundColor: c.cardAlt, borderRadius: Radius.md, padding: Space.md }}>
        <T variant="caption">Server: {serverUrl} · change it from the sign-in screen</T>
      </View>
    </Screen>
  );
}
