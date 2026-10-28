import React, { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

export default function ApiStateScreen() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function fetchRandomResult() {
        setLoading(true);
        setData(null);
        setError(null);

        const status = Math.random() < 0.5 ? 200 : 503;

        try {
            const response = await fetch(`https://httpbin.org/status/${status}`);

            if (!response.ok) {
                throw new Error(`The API returned HTTP ${response.status}.`);
            }

            setData({ status: response.status, message: 'The request succeeded.' });
        } catch (requestError) {
            setError(requestError.message || 'The request failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>API request</Text>
            <Text style={styles.description}>
                Send a request and see whether the API succeeds or fails.
            </Text>
            <Button
                title={loading ? 'Requesting...' : 'Make request'}
                onPress={fetchRandomResult}
                disabled={loading}
            />
            {loading && <ActivityIndicator style={styles.result} />}
            {error && <Text style={styles.error}>{error}</Text>}
            {data && (
                <Text style={styles.success}>
                    {data.message} (HTTP {data.status})
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    title: { fontSize: 24, fontWeight: '600' },
    description: { textAlign: 'center' },
    result: { marginTop: 8 },
    error: { color: '#b91c1c', textAlign: 'center' },
    success: { color: '#15803d', textAlign: 'center' },
});