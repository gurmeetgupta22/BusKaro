import axios from 'axios';
import { store, logout, setToken } from '../store';
import { API_URL } from '../config';

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach the current access token to every request
api.interceptors.request.use(
    (config) => {
        const token = store.getState().user.token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Track if a refresh is already in progress so we don't loop
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onTokenRefreshed = (token: string) => {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
};

// Response interceptor: on 401, try to refresh the access token silently
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only attempt refresh on 401, and not if this is itself the refresh call
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
            originalRequest._retry = true;

            const refreshToken = store.getState().user.refreshToken;
            if (!refreshToken) {
                // No refresh token — hard logout
                store.dispatch(logout());
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Queue the request until the refresh completes
                return new Promise(resolve => {
                    refreshSubscribers.push((token: string) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            isRefreshing = true;
            try {
                const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
                // Backend returns: { success: true, data: { accessToken, refreshToken } }
                const newAccessToken: string = response.data?.data?.accessToken;

                if (!newAccessToken) throw new Error('No access token in refresh response');

                // Update store with new token
                store.dispatch(setToken(newAccessToken));
                onTokenRefreshed(newAccessToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed — hard logout
                store.dispatch(logout());
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
