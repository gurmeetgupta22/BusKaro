import { configureStore, createSlice, PayloadAction, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserState {
    user: any | null;
    token: string | null;
    refreshToken: string | null;
    role: 'STUDENT' | 'DRIVER' | 'ADMIN' | null;
    isAuthenticated: boolean;
}

const initialUserState: UserState = {
    user: null,
    token: null,
    refreshToken: null,
    role: null,
    isAuthenticated: false,
};

const userSlice = createSlice({
    name: 'user',
    initialState: initialUserState,
    reducers: {
        setUser: (state, action: PayloadAction<{ user: any; token: string; refreshToken?: string }>) => {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.refreshToken = action.payload.refreshToken || state.refreshToken;
            state.role = action.payload.user.role;
            state.isAuthenticated = true;
        },
        setToken: (state, action: PayloadAction<string>) => {
            state.token = action.payload;
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.role = null;
            state.isAuthenticated = false;
        },
    },
});

interface TrackingState {
    buses: any[];
    myLocation: { lat: number; lng: number } | null;
    activePickups: any[];
    eta: number | null;
}

const initialTrackingState: TrackingState = {
    buses: [],
    myLocation: null,
    activePickups: [],
    eta: null,
};

const trackingSlice = createSlice({
    name: 'tracking',
    initialState: initialTrackingState,
    reducers: {
        updateBuses: (state, action: PayloadAction<any[]>) => {
            state.buses = action.payload;
        },
        updateBusLocation: (state, action: PayloadAction<{
            busId: string;
            lat: number | null;
            lng: number | null;
            busNumber?: string;
            routeName?: string;
            isLive?: boolean;
            lastUpdate?: string | null;
            remove?: boolean;
        }>) => {
            const index = state.buses.findIndex(b => (b.busId === action.payload.busId || b.id === action.payload.busId));

            // Remove bus from list (called after 2-min offline timeout)
            if (action.payload.remove) {
                if (index !== -1) state.buses.splice(index, 1);
                return;
            }

            if (index !== -1) {
                state.buses[index] = {
                    ...state.buses[index],
                    lat: action.payload.lat,
                    lng: action.payload.lng,
                    isLive: action.payload.isLive ?? state.buses[index].isLive,
                    lastUpdate: action.payload.lastUpdate ?? new Date().toISOString(),
                };
            } else if (action.payload.busNumber && action.payload.lat != null) {
                // New bus just came online — add it
                state.buses.push({
                    busId: action.payload.busId,
                    busNumber: action.payload.busNumber,
                    routeName: action.payload.routeName || 'Unknown Route',
                    lat: action.payload.lat,
                    lng: action.payload.lng,
                    isLive: action.payload.isLive ?? true,
                    lastUpdate: action.payload.lastUpdate || new Date().toISOString(),
                });
            }
        },
        setMyLocation: (state, action: PayloadAction<{ lat: number; lng: number }>) => {
            state.myLocation = action.payload;
        },
        setETA: (state, action: PayloadAction<number | null>) => {
            state.eta = action.payload;
        },
        addPickup: (state, action: PayloadAction<any>) => {
            state.activePickups.push(action.payload);
        },
        removePickup: (state, action: PayloadAction<string>) => {
            state.activePickups = state.activePickups.filter(p =>
                p.id !== action.payload && p.pickupId !== action.payload
            );
        },
        setPickups: (state, action: PayloadAction<any[]>) => {
            state.activePickups = action.payload;
        },
    },
});

export const { setUser, logout, setToken } = userSlice.actions;
export const {
    updateBuses,
    updateBusLocation,
    setMyLocation,
    setETA,
    addPickup,
    removePickup,
    setPickups
} = trackingSlice.actions;

const rootReducer = combineReducers({
    user: userSlice.reducer,
    tracking: trackingSlice.reducer,
});

const persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    whitelist: ['user'], // only persist user state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
