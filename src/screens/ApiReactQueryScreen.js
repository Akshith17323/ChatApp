import React from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

async function requestRandomResult() {
    const status = Math.random() < 0.5 ? 200 : 503;
    const response = await fetch(`https://httpbin.org/status/${status}`);

    if (!response.ok) {
        throw new Error(`The API returned HTTP ${response.status}.`);
    }

    return { status: response.status, message: 'The request succeeded.' };
}

export default function ApiReactQueryScreen() {
    const request = useMutation({ mutationFn: requestRandomResult });
    // request -> { }
    return (
        <View style={styles.container}>
            <Text style={styles.title}>API request with React Query</Text>
            <Text style={styles.description}>
                Send a request and see whether the API succeeds or fails.
            </Text>
            <Button
                title={request.isPending ? 'Requesting...' : 'Make request'}
                onPress={() => request.mutate()}
                disabled={request.isPending}
            />
            {request.isPending && <ActivityIndicator style={styles.result} />}
            {request.error && <Text style={styles.error}>{request.error.message}</Text>}
            {request.data && (
                <Text style={styles.success}>
                    {request.data.message} (HTTP {request.data.status})
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    title: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
    description: { textAlign: 'center' },
    result: { marginTop: 8 },
    error: { color: '#b91c1c', textAlign: 'center' },
    success: { color: '#15803d', textAlign: 'center' },
});