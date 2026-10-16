import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, success, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { ApiError, get } from '@/lib/api';
import { flowParams, useFlowParams } from '@/lib/flow';
import type { Food } from '@/lib/types';

export default function ScanScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = flowParams(useFlowParams());
  const [permission, requestPermission] = useCameraPermissions();
  const [looking, setLooking] = useState(false);
  const busy = useRef(false);

  const onScanned = async ({ data }: { data: string }) => {
    if (busy.current) return;
    busy.current = true;
    setLooking(true);
    success();
    try {
      const { food } = await get<{ food: Food }>(`/foods/barcode/${encodeURIComponent(data)}`);
      router.replace({ pathname: '/food/[id]', params: { id: food._id, ...params } });
    } catch (e: any) {
      const notFound = e instanceof ApiError && e.status === 404;
      Alert.alert(notFound ? 'Not found' : 'Lookup failed', e.message, [
        { text: 'Scan again', onPress: () => { busy.current = false; setLooking(false); } },
        ...(notFound ? [{ text: 'Add it myself', onPress: () => router.replace({ pathname: '/custom-food', params: { ...params, barcode: data } }) }] : []),
      ]);
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: Space.xl, justifyContent: 'center', gap: Space.lg }}>
        <T variant="h2" style={{ textAlign: 'center' }}>Camera access</T>
        <T muted style={{ textAlign: 'center' }}>We use the camera only to read barcodes on food packages.</T>
        <Button title="Allow camera" onPress={requestPermission} />
        <Button title="Cancel" kind="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={looking ? undefined : onScanned}
      />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        <View style={{ width: 280, height: 160, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
        <T style={{ color: '#fff', marginTop: Space.lg, fontWeight: '600' }}>{looking ? 'Looking it up…' : 'Point at a barcode'}</T>
        {looking && <ActivityIndicator color="#fff" style={{ marginTop: Space.sm }} />}
      </View>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ position: 'absolute', top: insets.top + 12, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}
