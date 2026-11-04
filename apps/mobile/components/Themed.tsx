import { Text as DefaultText, View as DefaultView, type TextProps as RNTextProps, type ViewProps as RNViewProps } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

type ColorName = keyof typeof Colors.light;

export function useThemeColor(name: ColorName): string {
  return Colors[useColorScheme()][name];
}

export type TextProps = RNTextProps & { muted?: boolean };
export type ViewProps = RNViewProps & { card?: boolean };

export function Text({ style, muted, ...rest }: TextProps) {
  const color = useThemeColor(muted ? 'muted' : 'text');
  return <DefaultText style={[{ color }, style]} {...rest} />;
}

export function View({ style, card, ...rest }: ViewProps) {
  const backgroundColor = useThemeColor(card ? 'card' : 'background');
  const borderColor = useThemeColor('border');
  return (
    <DefaultView
      style={[{ backgroundColor }, card && { borderColor, borderWidth: 1, borderRadius: 12, padding: 14 }, style]}
      {...rest}
    />
  );
}
