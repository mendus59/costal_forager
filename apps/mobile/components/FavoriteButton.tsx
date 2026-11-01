import { Pressable, Text } from 'react-native';

import { useUser } from '@/lib/store';
import { useThemeColor } from './Themed';

export function FavoriteButton({ bidn, name }: { bidn: string; name: string }) {
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
      <Text style={{ fontSize: 24, color: on ? tint : muted }}>{on ? '★' : '☆'}</Text>
    </Pressable>
  );
}
