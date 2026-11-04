import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // On the web the tab bar sits at the top of the page, like a site nav bar.
        // The phone apps keep it at the bottom, where thumbs can reach it.
        tabBarPosition: Platform.OS === 'web' ? 'top' : 'bottom',
        // Disable the static render of the header on web to prevent a hydration error.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'pin_drop', web: 'pin_drop' }} tintColor={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'sun.horizon', android: 'wb_twilight', web: 'wb_twilight' }} tintColor={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="beaches"
        options={{
          title: 'Beaches',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} tintColor={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={color} size={26} />
          ),
        }}
      />
    </Tabs>
  );
}
