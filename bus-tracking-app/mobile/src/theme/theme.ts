export const theme = {
    colors: {
        primary: '#10b981', // Emerald 500 (Greenish)
        primaryLight: '#34d399',
        primaryDark: '#059669',
        secondary: '#f59e0b', // Amber 500
        accent: '#10b981',
        error: '#ef4444',
        background: '#ffffff', // Pure White
        surface: '#ffffff',
        text: '#1e293b',
        textLight: '#64748b',
        border: '#f1f5f9',

        // Status colors
        paid: '#10b981',
        due: '#64748b',
        overdue: '#ef4444',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 40,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
    },
    typography: {
        h1: {
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1e293b',
        },
        h2: {
            fontSize: 24,
            fontWeight: 'bold',
            color: '#1e293b',
        },
        h3: {
            fontSize: 20,
            fontWeight: '600',
            color: '#1e293b',
        },
        body: {
            fontSize: 16,
            color: '#1e293b',
        },
        caption: {
            fontSize: 14,
            color: '#64748b',
        },
    },
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 15,
            elevation: 8,
        },
        none: {
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
        }
    },
};
