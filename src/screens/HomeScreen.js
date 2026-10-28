import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home & Demos</Text>
            <Button
                title="Open Chat App"
                onPress={() =>
                    navigation.navigate('ChatTab')
                }
            />
            <Button
                title="Open details"
                onPress={() =>
                    navigation.navigate('Details', { id: 1, title: 'Item 1' })
                }
            />
            <Button
                title="Try API request"
                onPress={() => navigation.navigate('ApiState')}
            />
            <Button
                title="Try API request with React Query"
                onPress={() => navigation.navigate('ApiReactQuery')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    title: { fontSize: 24, fontWeight: '600' },
});
