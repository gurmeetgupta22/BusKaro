import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    StatusBar,
    ImageBackground,
    Dimensions,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { setUser } from '../store';
import api from '../api/client';
import { API_URL } from '../config';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');
const BG_IMAGE = require('../../assets/images/background.png');

type LoginType = 'STUDENT' | 'DRIVER';

const LoginScreen: React.FC = () => {
    const dispatch = useDispatch();
    const [loginType, setLoginType] = useState<LoginType>('STUDENT');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            const { user, tokens } = response.data.data;

            // Role guard – make sure the user is logging in with the correct role
            const expectedRole = loginType === 'STUDENT' ? 'STUDENT' : 'DRIVER';
            if (user.role !== expectedRole) {
                Alert.alert(
                    'Wrong Portal',
                    `This account is registered as ${user.role.toLowerCase()}. Please use the correct login portal.`
                );
                setLoading(false);
                return;
            }

            dispatch(setUser({ user, token: tokens.accessToken, refreshToken: tokens.refreshToken }));
        } catch (error: any) {
            let msg = 'Login failed. Please check your credentials.';
            if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
                msg = `Connection timed out.\nServer: ${API_URL}\n\nMake sure the backend is running and your phone is on the same Wi-Fi.`;
            } else if (!error?.response) {
                msg = `Cannot reach the server.\n\nTrying: ${API_URL}\n\nMake sure:\n1. Backend is running (npm run dev)\n2. Phone & PC are on the same Wi-Fi`;
            } else if (error?.response?.data?.message) {
                msg = error.response.data.message;
            }
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground source={BG_IMAGE} style={styles.bg} resizeMode="cover">
            <StatusBar barStyle="light-content" />
            {/* Overlay */}
            <View style={styles.overlay} />

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header branding */}
                <View style={styles.headerSection}>
                    <Text style={styles.appTitle}>🚌 BusTrack</Text>
                    <Text style={styles.appSubtitle}>College Bus Tracking System</Text>
                </View>

                {/* Card */}
                <View style={styles.card}>
                    {/* Tab selector */}
                    <View style={styles.tabRow}>
                        <TouchableOpacity
                            style={[styles.tab, loginType === 'STUDENT' && styles.tabActive]}
                            onPress={() => setLoginType('STUDENT')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.tabText, loginType === 'STUDENT' && styles.tabTextActive]}>
                                Student
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, loginType === 'DRIVER' && styles.tabActive]}
                            onPress={() => setLoginType('DRIVER')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.tabText, loginType === 'DRIVER' && styles.tabTextActive]}>
                                Driver
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.loginTitle}>
                        {loginType === 'STUDENT' ? 'Student Login' : 'Driver Login'}
                    </Text>
                    <Text style={styles.loginSubtitle}>
                        Use your college email &amp; default password
                    </Text>

                    {/* Email */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>College Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@college.edu"
                            placeholderTextColor={theme.colors.textLight}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="password"
                            placeholderTextColor={theme.colors.textLight}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.loginBtnText}>
                                {loginType === 'STUDENT' ? 'Sign In as Student' : 'Sign In as Driver'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Switch portal links */}
                    {loginType === 'STUDENT' ? (
                        <TouchableOpacity
                            style={styles.switchLink}
                            onPress={() => setLoginType('DRIVER')}
                        >
                            <Text style={styles.switchLinkText}>
                                Are you a driver?{' '}
                                <Text style={styles.switchLinkHighlight}>Driver Login →</Text>
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.switchLink}
                            onPress={() => setLoginType('STUDENT')}
                        >
                            <Text style={styles.switchLinkText}>
                                Are you a student?{' '}
                                <Text style={styles.switchLinkHighlight}>Student Login →</Text>
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.footerNote}>Default password: "password" (change after first login)</Text>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        width,
        height,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.52)',
    },
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        paddingTop: 60,
        paddingHorizontal: 24,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    appTitle: {
        fontSize: 36,
        fontWeight: '800',
        color: 'white',
        letterSpacing: 1,
    },
    appSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 6,
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        ...theme.shadows.md,
    },
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: theme.colors.primary,
    },
    tabText: {
        fontWeight: '600',
        color: theme.colors.textLight,
        fontSize: 14,
    },
    tabTextActive: {
        color: 'white',
    },
    loginTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    loginSubtitle: {
        fontSize: 13,
        color: theme.colors.textLight,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
    },
    inputWrapper: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.colors.text,
        backgroundColor: '#fafafa',
    },
    loginBtn: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 4,
    },
    loginBtnDisabled: {
        opacity: 0.7,
    },
    loginBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.3,
    },
    switchLink: {
        alignItems: 'center',
        paddingTop: 14,
    },
    switchLinkText: {
        fontSize: 13,
        color: theme.colors.textLight,
    },
    switchLinkHighlight: {
        color: theme.colors.primary,
        fontWeight: '700',
    },
    footerNote: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        marginTop: 20,
    },
});

export default LoginScreen;
