import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ChatStack from './ChatStack';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
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
                  backgroundColor: '#FFFFFF',
                  borderTopColor: '#E5E5EA',
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
