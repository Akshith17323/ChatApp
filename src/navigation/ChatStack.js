import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import AuthScreen from '../screens/AuthScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import NewChatScreen from '../screens/NewChatScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  const { isAuthenticated } = useAuth();
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitle: 'Messages',
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: colors.surface,
        },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="ChatList"
            component={ChatListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={{
              headerBackTitle: 'Messages',
            }}
          />
          <Stack.Screen
            name="NewChat"
            component={NewChatScreen}
            options={{
              title: 'New Message',
              headerBackTitle: 'Cancel',
              headerShadowVisible: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
