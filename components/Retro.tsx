import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.screen,
    {
      paddingTop: Platform.OS === 'web' ? Math.max(67, insets.top + 16) : insets.top + 16,
      paddingBottom: Platform.OS === 'web' ? Math.max(34, insets.bottom + 20) : insets.bottom + 20,
    },
  ];
  if (!scroll) return <View style={[contentStyle, { backgroundColor: colors.background }]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="none"
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  const colors = useColors();
  return <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontSize: small ? 34 : 52 }]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.foreground }]}>{children}</Text>;
}

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }, style]}>{children}</View>;
}

export function Button({ title, tone = 'primary', ...props }: PressableProps & { title: string; tone?: 'primary' | 'secondary' | 'accent' | 'paper' }) {
  const colors = useColors();
  const backgroundColor = tone === 'primary' ? colors.primary : tone === 'secondary' ? colors.secondary : tone === 'accent' ? colors.accent : colors.card;
  const color = tone === 'primary' ? colors.primaryForeground : tone === 'secondary' ? colors.secondaryForeground : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: colors.border, shadowColor: colors.foreground },
        pressed && styles.pressed,
        props.disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20, gap: 16 },
  title: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: -2, lineHeight: 54 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5 },
  panel: {
    borderWidth: 4, padding: 20, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  button: {
    minHeight: 58, borderWidth: 4, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 18, textTransform: 'uppercase', textAlign: 'center' },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 } },
  disabled: { opacity: 0.45 },
});