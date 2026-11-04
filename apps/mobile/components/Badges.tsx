import type { Rating } from '@costal-forager/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RatingColors, StatusColors } from '@/constants/Colors';
import { useThemeColor } from './Themed';

export function RatingBadge({ rating, large }: { rating: Rating; large?: boolean }) {
  const c = RatingColors[rating];
  return (
    <View style={[styles.badge, large && styles.large, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, large && styles.largeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c = StatusColors[status] ?? StatusColors.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

/** A selectable pill, used for species and day-of-week pickers. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const tint = useThemeColor('tint');
  const border = useThemeColor('border');
  const text = useThemeColor('text');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? tint : border, backgroundColor: selected ? tint : 'transparent' }]}>
      <Text style={{ color: selected ? '#fff' : text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
  large: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  largeText: { fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
});
