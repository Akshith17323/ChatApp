import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import ChatStack from './ChatStack';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { colors } = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          elevation: 8,
          height: Platform.OS === 'android' ? 60 : 84,
          paddingBottom: Platform.OS === 'android' ? 8 : 28,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: -0.2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'chatbubble-ellipses';
          if (route.name === 'ChatTab') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'SettingsTab') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size || 23} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'ChatList';
          const shouldHideTabBar = routeName === 'ChatRoom' || routeName === 'NewChat';
          return {
            title: 'Messages',
            headerShown: false,
            tabBarStyle: shouldHideTabBar
              ? { display: 'none' }
              : {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.separator,
                  borderTopWidth: 0.5,
                  elevation: 8,
                  height: Platform.OS === 'android' ? 60 : 84,
                  paddingBottom: Platform.OS === 'android' ? 8 : 28,
                  paddingTop: 6,
                },
          };
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ title: 'Settings', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
