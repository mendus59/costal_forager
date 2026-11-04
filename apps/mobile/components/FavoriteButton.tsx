import { Pressable, Text } from 'react-native';

import { useUser } from '@/lib/store';
import { useThemeColor } from './Themed';

export function FavoriteButton({ bidn, name, size = 24 }: { bidn: string; name: string; size?: number }) {
  const { favoriteBeaches, toggleBeach } = useUser();
  const on = favoriteBeaches.includes(bidn);
  const tint = useThemeColor('tint');
  const muted = useThemeColor('muted');
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      onPress={() => toggleBeach(bidn)}>
      <Text style={{ fontSize: size, lineHeight: size * 1.15, color: on ? tint : muted }}>{on ? '★' : '☆'}</Text>
    </Pressable>
  );
}
