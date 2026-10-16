import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, ErrorText, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { checkServer, normalizeUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AuthScreen() {
  const c = useTheme();
  const { signIn, signUp, serverUrl, changeServer } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await signIn(username, password);
      else await signUp(name, username, password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: 80 }}>
        <View style={{ alignItems: 'center', gap: Space.sm, marginBottom: Space.xl }}>
          <View style={{ width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="nutrition" size={38} color={c.accentText} />
          </View>
          <T variant="title">Macro Kitchen</T>
          <T muted>Track meals, recipes and leftovers.</T>
        </View>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'login', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
        />
        {mode === 'register' && <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" textContentType="name" />}
        <Field label="Username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" autoCorrect={false} textContentType="username" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'register' ? 'At least 6 characters' : 'Password'}
          secureTextEntry
          textContentType={mode === 'register' ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <ErrorText>{error}</ErrorText>
        <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} disabled={!username || !password || (mode === 'register' && !name)} />
        <ServerSetting current={serverUrl} onSave={changeServer} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Where the API lives: your Mac, a Raspberry Pi, a hosted server… */
function ServerSetting({ current, onSave }: { current: string; onSave: (url: string | null) => Promise<void> }) {
  const c = useTheme();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<'idle' | 'checking' | 'unreachable'>('idle');

  const save = async (force = false) => {
    if (!force) {
      setStatus('checking');
      if (!(await checkServer(value))) return setStatus('unreachable');
    }
    await onSave(value.trim() ? value : null);
    setStatus('idle');
    setEditing(false);
  };

  if (!editing) {
    return (
      <T variant="caption" style={{ textAlign: 'center', marginTop: Space.md }} onPress={() => { setValue(current); setEditing(true); }}>
        Server: {current} · <T variant="caption" color={c.accent} style={{ fontWeight: '700' }}>Change</T>
      </T>
    );
  }
  return (
    <View style={{ gap: Space.sm, marginTop: Space.md }}>
      <Field
        label="Server address"
        value={value}
        onChangeText={(t) => { setValue(t); setStatus('idle'); }}
        placeholder="192.168.1.20 or https://my-server.example"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint={value.trim() ? `Will use ${normalizeUrl(value)}` : undefined}
      />
      {status === 'unreachable' && <ErrorText>No Macro Kitchen server answered there. Check the address and that the server is running.</ErrorText>}
      <Row gap={Space.sm}>
        <Button small title="Test & save" onPress={() => save()} loading={status === 'checking'} style={{ flex: 1 }} />
        {status === 'unreachable' && <Button small kind="secondary" title="Save anyway" onPress={() => save(true)} style={{ flex: 1 }} />}
        <Button small kind="ghost" title="Cancel" onPress={() => setEditing(false)} />
      </Row>
    </View>
  );
}
