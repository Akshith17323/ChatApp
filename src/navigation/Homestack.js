import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import DetailsScreen from '../screens/Detailsscreen';
import ApiStateScreen from '../screens/ApiStateScreen';
import ApiReactQueryScreen from '../screens/ApiReactQueryScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
    return (
        <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={HomeScreen} options={{
                headerShown: false
            }} />
            <Stack.Screen
                name="Details"
                component={DetailsScreen}
                options={({ route }) => ({ title: route.params?.title ?? 'Details' })}
            />
            <Stack.Screen
                name="ApiState"
                component={ApiStateScreen}
                options={{ title: 'API request' }}
            />
            <Stack.Screen
                name="ApiReactQuery"
                component={ApiReactQueryScreen}
                options={{ title: 'API request with React Query' }}
            />
        </Stack.Navigator>
    );
}
