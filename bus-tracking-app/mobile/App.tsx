import React, { useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { store, RootState, persistor } from './src/store';
import { PersistGate } from 'redux-persist/integration/react';
import StudentHomeScreen from './src/screens/student/HomeScreen';
import DriverHomeScreen from './src/screens/driver/HomeScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import LoginScreen from './src/screens/LoginScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <SafeAreaProvider>
                        {isLoading ? (
                            <LoadingScreen onFinish={() => setIsLoading(false)} />
                        ) : (
                            <MainNavigator />
                        )}
                    </SafeAreaProvider>
                </GestureHandlerRootView>
            </PersistGate>
        </Provider>
    );
}

const MainNavigator = () => {
    const { role, isAuthenticated } = useSelector((state: RootState) => state.user);

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    if (role === 'DRIVER') {
        return <DriverHomeScreen />;
    }

    return <StudentHomeScreen />;
};
