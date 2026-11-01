import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { Text, useThemeColor } from './Themed';

interface Props {
  label: string;
  value: string;
  onMinus(): void;
  onPlus(): void;
  hint?: string;
}

/** A labeled value with − and + buttons. */
export function Stepper({ label, value, onMinus, onPlus, hint }: Props) {
  const border = useThemeColor('border');
  const tint = useThemeColor('tint');
  const btn = (text: string, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      hitSlop={6}
      style={[styles.btn, { borderColor: border }]}>
      <RNText style={{ color: tint, fontSize: 18, fontWeight: '700' }}>{text}</RNText>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text muted style={styles.hint}>{hint}</Text> : null}
      </View>
      {btn('−', onMinus, `Decrease ${label}`)}
      <Text style={styles.value}>{value}</Text>
      {btn('+', onPlus, `Increase ${label}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  labels: { flex: 1 },
  label: { fontSize: 15 },
  hint: { fontSize: 12, marginTop: 2 },
  btn: { width: 36, height: 36, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 84, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
});
