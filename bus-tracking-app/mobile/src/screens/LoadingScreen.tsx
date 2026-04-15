import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, Animated, Image } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

const SPLASH_IMAGE = require('../icons/bussplashscreen.png');

interface LoadingScreenProps {
    onFinish: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinish }) => {
    const [progress, setProgress] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Slow fade-in for the image
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
        }).start();

        // Progress bar animation
        const duration = 4000; // 4 seconds total (slower as requested)
        const interval = 30;
        const steps = duration / interval;
        const increment = 100 / steps;

        const timer = setInterval(() => {
            setProgress((prev) => {
                const next = prev + increment;
                if (next >= 100) {
                    clearInterval(timer);
                    setTimeout(onFinish, 800); // Wait bit more before finishing
                    return 100;
                }
                return next;
            });
        }, interval);

        Animated.timing(progressAnim, {
            toValue: 1,
            duration: duration,
            useNativeDriver: false,
        }).start();

        return () => clearInterval(timer);
    }, [onFinish]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Image with slow fade-in */}
                <Animated.View style={{ opacity: fadeAnim }}>
                    <Image
                        source={SPLASH_IMAGE}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Loading Text */}
                <Text style={styles.loadingText}>Initializing Tracking System...</Text>

                {/* Progress Bar Container */}
                <View style={styles.progressBarWrapper}>
                    <View style={styles.progressBarBackground}>
                        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
                    </View>
                    <Text style={styles.percentageText}>{Math.round(progress)}%</Text>
                </View>
            </View>

            {/* Footer Text */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Secure AI-Powered Bus Tracking</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        width: '80%',
    },
    logo: {
        width: 280,
        height: 280,
        marginBottom: 40,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 30,
        letterSpacing: 0.5,
    },
    progressBarWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    progressBarBackground: {
        width: '100%',
        height: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 4,
    },
    percentageText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
    footerText: {
        fontSize: 12,
        color: theme.colors.textLight,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
});

export default LoadingScreen;
