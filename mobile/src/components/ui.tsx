import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Radius, Space, useTheme } from '@/constants/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export const tap = () => Haptics.selectionAsync().catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// ---------- Text ----------

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'label' | 'caption' | 'number';
const variants: Record<Variant, TextStyle> = {
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  caption: { fontSize: 13 },
  number: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export function T({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const c = useTheme();
  const defaultColor = variant === 'label' || variant === 'caption' || muted ? c.textSecondary : c.text;
  return <Text {...rest} style={[variants[variant], { color: color ?? defaultColor }, style]} />;
}

// ---------- Layout ----------

export function Screen({ children, contentStyle, ...rest }: ScrollViewProps & { contentStyle?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: Space.lg, gap: Space.lg, paddingBottom: 48 }, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useTheme();
  const base: ViewStyle = { backgroundColor: c.card, borderRadius: Radius.lg, padding: Space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }, style]}>
      {children}
    </Pressable>
  );
}

export const Row = ({ children, style, gap = Space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: Space.sm, marginBottom: -Space.xs }}>
      <T variant="label">{title}</T>
      {action}
    </Row>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

// ---------- Controls ----------

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = { primary: c.accent, secondary: c.cardAlt, ghost: 'transparent', danger: c.dangerSoft }[kind];
  const fg = { primary: c.accentText, secondary: c.text, ghost: c.accent, danger: c.danger }[kind];
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: Radius.md,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 12 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
          <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 22 }: { icon: IconName; onPress: () => void; color?: string; size?: number }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
      <Ionicons name={icon} size={size} color={color ?? c.accent} />
    </Pressable>
  );
}

export function Field({ label, hint, style, ...rest }: TextInputProps & { label?: string; hint?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6, flex: (style as any)?.flex }}>
      {label && <T variant="caption" style={{ fontWeight: '600' }}>{label}</T>}
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[
          { backgroundColor: c.cardAlt, color: c.text, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
          style,
        ]}
        {...rest}
      />
      {hint && <T variant="caption" muted>{hint}</T>}
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; disabled?: boolean }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: Radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.disabled}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: Radius.sm + 2,
              alignItems: 'center',
              backgroundColor: active ? c.card : 'transparent',
              opacity: o.disabled ? 0.35 : 1,
              shadowColor: '#000',
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
            }}>
            <Text style={{ fontWeight: active ? '700' : '500', color: active ? c.text : c.textSecondary, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: Radius.pill,
        backgroundColor: active ? c.accentSoft : c.cardAlt,
        borderWidth: 1,
        borderColor: active ? c.accent : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Text style={{ color: active ? c.accent : c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  icon,
  titleLines = 1,
}: {
  title: string;
  titleLines?: number;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 10 })}>
      <Row gap={Space.md}>
        {icon && (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={18} color={c.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T numberOfLines={titleLines} style={{ fontWeight: '600' }}>{title}</T>
          {subtitle ? <T variant="caption" numberOfLines={1}>{subtitle}</T> : null}
        </View>
        {right}
      </Row>
    </Pressable>
  );
}

export function Empty({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={c.accent} />
      </View>
      <T variant="h3" style={{ textAlign: 'center' }}>{title}</T>
      {message && <T muted style={{ textAlign: 'center' }}>{message}</T>}
      {action}
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const c = useTheme();
  if (!children) return null;
  return (
    <View style={{ backgroundColor: c.dangerSoft, borderRadius: Radius.md, padding: Space.md }}>
      <T color={c.danger} style={{ fontWeight: '600' }}>{children}</T>
    </View>
  );
}

export function Loading() {
  const c = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: 40 }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}
