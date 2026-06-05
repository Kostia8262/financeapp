import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useLanguage } from '../../src/context/LanguageContext';

function TabIcon({ name, color, focused }) {
  return (
    <View style={[ico.wrap, focused && ico.active]}>
      <Ionicons name={focused ? name : name + '-outline'} size={21} color={color} />
    </View>
  );
}

const ico = StyleSheet.create({
  wrap:   { width: 40, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: Colors.primaryLight },
});

export default function TabsLayout() {
  const { t } = useLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('tab_transactions'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="list" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('tab_analytics'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="bar-chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="balance"
        options={{
          title: t('tab_balance'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: t('categories'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tab_settings'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
