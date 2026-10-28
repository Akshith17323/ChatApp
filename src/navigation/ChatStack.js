import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import NewChatScreen from '../screens/NewChatScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator>
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
            options={{ title: 'Messages', headerShadowVisible: false }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={{ headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="NewChat"
            component={NewChatScreen}
            options={{ title: 'Start a Chat', headerBackTitle: 'Cancel' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
