import React, { useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    Dimensions,
    TextInput,
    ImageBackground,
    ScrollView,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSelector, useDispatch } from 'react-redux';
import { MapPin, Navigation, Search, X, ArrowLeft, Menu, User, Settings as SettingsIcon, LogOut, Lock, MessageSquare, Clock, Bus } from 'lucide-react-native';
import { theme } from '../../theme/theme';
import { RootState } from '../../store';
import { setMyLocation, updateBuses, updateBusLocation, addPickup, setPickups, removePickup, logout, setToken } from '../../store';
import { store } from '../../store';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import api from '../../api/client';
import { SOCKET_URL, BUS_OFFLINE_VISIBLE_MS } from '../../config';

const { width, height } = Dimensions.get('window');
const BG_IMAGE = require('../../../assets/images/background.png');

const StudentHomeScreen = () => {
    const dispatch = useDispatch();
    const { buses, myLocation, activePickups } = useSelector((state: RootState) => state.tracking);
    const { token, user } = useSelector((state: RootState) => state.user);

    const [socket, setSocket] = useState<Socket | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

    // Pickup states
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [manualPickupLocation, setManualPickupLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [confirmedPickupPin, setConfirmedPickupPin] = useState<{ lat: number, lng: number, id: string } | null>(null);

    // UI states
    const [isFullScreenMap, setIsFullScreenMap] = useState(false);

    // Menu & Modals
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);

    // Form states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [issueText, setIssueText] = useState('');

    const [isDriverNearby, setIsDriverNearby] = useState(false);
    const prevBusesRef = React.useRef<any[]>([]);

    const smallMapRef = React.useRef<MapView>(null);
    const fullMapRef = React.useRef<MapView>(null);

    const getActiveMapRef = () => isFullScreenMap ? fullMapRef.current : smallMapRef.current;

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword) {
            Alert.alert('Error', 'Please fill in both fields.');
            return;
        }
        try {
            await api.post('/auth/change-password', { currentPassword: oldPassword, newPassword });
            Alert.alert('Success', 'Password changed successfully!');
            setIsChangePasswordOpen(false);
            setOldPassword('');
            setNewPassword('');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.message || 'Failed to change password');
        }
    };

    const handleReportIssue = async () => {
        if (!issueText.trim()) {
            Alert.alert('Error', 'Please describe the issue.');
            return;
        }
        try {
            await api.post('/students/report-issue', { issue: issueText });
            Alert.alert('Success', 'Issue reported successfully! The admin will look into it.');
            setIsReportIssueOpen(false);
            setIssueText('');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.message || 'Failed to report issue');
        }
    };

    const [hasAutoFitBuses, setHasAutoFitBuses] = useState(false);

    useEffect(() => {
        if (!hasAutoFitBuses && buses.length > 0) {
            const hasLocations = buses.some(b => b.lat != null);
            if (hasLocations) {
                const mapRef = getActiveMapRef();
                if (mapRef) {
                    const coords = buses
                        .filter(b => b.lat != null)
                        .map(b => ({ latitude: Number(b.lat), longitude: Number(b.lng) }));

                    if (coords.length > 0) {
                        mapRef.fitToCoordinates(coords, {
                            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                            animated: true
                        });
                        setHasAutoFitBuses(true);
                    }
                }
            }
        }
    }, [buses, hasAutoFitBuses]);

    useEffect(() => {
        // 1. Get Location Permissions
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.error('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            const coords = {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };
            dispatch(setMyLocation(coords));

            // Auto-center on startup
            getActiveMapRef()?.animateToRegion({
                latitude: coords.lat,
                longitude: coords.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
        })();
    }, []);

    // Effect to monitor driver proximity for banner update
    useEffect(() => {
        const myPickup = activePickups.find(
            p => p.studentId === user?.student?.id || p.student?.id === user?.student?.id
        ) || (confirmedPickupPin ? { lat: confirmedPickupPin.lat, lng: confirmedPickupPin.lng } : null);

        if (!myPickup) {
            setIsDriverNearby(false);
            return;
        }

        const pickupLat = Number(myPickup.lat);
        const pickupLng = Number(myPickup.lng);

        // Check if any bus is within ~250m of the pickup location
        const nearbyBus = buses.find(bus => {
            if (bus.lat == null || bus.lng == null) return false;
            const dLat = Math.abs(Number(bus.lat) - pickupLat);
            const dLng = Math.abs(Number(bus.lng) - pickupLng);
            return dLat < 0.0022 && dLng < 0.0022;
        });

        if (nearbyBus && !isDriverNearby) {
            setIsDriverNearby(true);
        } else if (!nearbyBus && isDriverNearby) {
            setIsDriverNearby(false);
        }
    }, [buses, activePickups, confirmedPickupPin, isDriverNearby, user?.student?.id]);

    useEffect(() => {
        // 2. Initialize Socket Connection
        // Read the LATEST token from store at connection time (may have been refreshed)
        const latestToken = store.getState().user.token;
        const s = io(SOCKET_URL, {
            auth: { token: latestToken },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });

        s.on('connect', () => {
            console.log('Connected to Tracking Server');
            s.emit('student:request-buses');
        });

        s.on('buses:list', (data: any) => {
            console.log('Received buses list:', data.buses.length);
            const normalizedBuses = data.buses.map((b: any) => {
                const busId = b.busId || b.id;
                const lat = b.lat ?? b.currentLat;
                const lng = b.lng ?? b.currentLng;
                const lastUpdate = b.lastUpdate || b.lastLocationUpdate || null;

                return {
                    ...b,
                    busId,
                    lat: lat != null ? Number(lat) : null,
                    lng: lng != null ? Number(lng) : null,
                    lastUpdate,
                    isLive: b.isLive,
                    isOfflineRecent: b.isOfflineRecent,
                };
            });
            dispatch(updateBuses(normalizedBuses));
        });

        s.on('bus:location-update', (data: any) => {
            console.log('✅ Live location update for bus:', data.busNumber, data.lat, data.lng);
            const lat = data.lat != null ? Number(data.lat) : null;
            const lng = data.lng != null ? Number(data.lng) : null;

            if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                dispatch(updateBusLocation({
                    busId: data.busId,
                    busNumber: data.busNumber,
                    routeName: data.routeName,
                    lat,
                    lng,
                    isLive: data.isLive !== false,
                    lastUpdate: data.timestamp || new Date().toISOString(),
                }));
            }
        });

        // Driver went offline — keep last known location visible (server will send bus:removed after 2 min)
        s.on('bus:offline', (data: any) => {
            console.log('🔴 Bus went offline:', data.busNumber, '| Last location kept visible for 2 min');
            const lat = data.lat != null ? Number(data.lat) : null;
            const lng = data.lng != null ? Number(data.lng) : null;

            if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                dispatch(updateBusLocation({
                    busId: data.busId,
                    busNumber: data.busNumber,
                    routeName: data.routeName,
                    lat,
                    lng,
                    isLive: false,
                    lastUpdate: data.lastUpdate || new Date().toISOString(),
                }));
            }
        });

        // Server signals removal after 2-minute offline timeout
        s.on('bus:removed', (data: any) => {
            console.log('🗑 Bus removed from map:', data.busId);
            dispatch(updateBusLocation({
                busId: data.busId,
                busNumber: '',
                routeName: '',
                lat: null as any,
                lng: null as any,
                isLive: false,
                remove: true,
                lastUpdate: null as any,
            }));
        });

        s.on('reconnect', () => {
            s.emit('student:request-buses');
        });

        s.on('pickup:cancelled', () => {
            // This event is for drivers, but if a student's pickup is cancelled by driver,
            // this might be used to update student UI.
            // For now, student's own cancellation logic is in handleCancelPickup.
        });

        s.on('pickup:completed', () => {
            // This event is for drivers, but if a student's pickup is completed by driver,
            // this might be used to update student UI.
        });

        s.on('pickup:picked', () => {
            // This event is for drivers, but if a student's pickup is picked by driver,
            // this might be used to update student UI.
        });

        s.on('pickup:confirmed', (data: any) => {
            console.log('STUDENT: Pickup confirmed:', data.id);
            dispatch(addPickup(data));
            // CRITICAL: Clear local pin so only REDUX renders it.
            setConfirmedPickupPin(null);
            setIsSelectionMode(false);
            setManualPickupLocation(null);
        });

        s.on('pickup:reached', (data: any) => {
            setIsDriverNearby(true);
            Alert.alert('Bus Arrived', 'The bus has reached your pickup location!');
        });

        s.on('pickup:cancelled', (data: any) => {
            dispatch(removePickup(data.pickupId));
            if (confirmedPickupPin?.id === data.pickupId) {
                setConfirmedPickupPin(null);
            }
            setIsDriverNearby(false);
        });

        s.on('pickup:picked', (data: any) => {
            console.log('STUDENT: Received pickup completion for:', data.pickupId);
            dispatch(removePickup(data.pickupId));
            setConfirmedPickupPin(null);
            setIsDriverNearby(false);
            Alert.alert('Picked Up', 'You have been successfully picked up!');
        });

        s.on('error', (err: any) => {
            Alert.alert('Server Error', err.message || 'Something went wrong');
        });

        // Handle socket auth errors by refreshing token and reconnecting
        s.on('connect_error', async (err: any) => {
            const errMsg = err?.message || '';
            if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('auth')) {
                console.warn('Socket auth error — attempting token refresh');
                try {
                    const currentRefreshToken = store.getState().user.refreshToken;
                    if (!currentRefreshToken) { dispatch(logout()); return; }
                    const resp = await api.post('/auth/refresh', { refreshToken: currentRefreshToken });
                    const newToken = resp.data?.data?.accessToken;
                    if (newToken) {
                        dispatch(setToken(newToken));
                        (s.auth as any).token = newToken;
                        s.connect();
                    } else {
                        dispatch(logout());
                    }
                } catch { dispatch(logout()); }
            }
        });

        setSocket(s);

        // Poll bus list every 10 seconds to get fresh locations from DB
        const pollInterval = setInterval(() => {
            if (s.connected) s.emit('student:request-buses');
        }, 10000);

        return () => {
            clearInterval(pollInterval);
            if (s) s.disconnect();
        };
    }, []);

    const handlePickMeUp = () => {
        if (!liveSelectedBus) {
            setIsSearching(true);
            return;
        }

        if (!isSelectionMode) {
            setIsSelectionMode(true);
            // Default pin is user's current location when they enter selection mode
            setManualPickupLocation(myLocation);

            Alert.alert('Select Location', 'Drag the map and tap on your exact location to set the pickup pin.');
            return;
        }

        if (socket && liveSelectedBus && manualPickupLocation) {
            const pickupId = `pickup-${Date.now()}`; // Local tracking ID

            socket.emit('student:pin-location', {
                lat: manualPickupLocation.lat,
                lng: manualPickupLocation.lng,
                address: 'Manually Selected Location'
            });

            // Set a local confirmed pin immediately for visual feedback
            setConfirmedPickupPin({
                lat: manualPickupLocation.lat,
                lng: manualPickupLocation.lng,
                id: pickupId,
            });

            Alert.alert('Pickup Requested', `Pickup sent to Bus ${liveSelectedBus.busNumber}! Tap the pin on the map to cancel.`);
            setIsSelectionMode(false);
            setManualPickupLocation(null);
            setSelectedBusId(null);
        }
    };

    const handleCancelPickup = (idOverride?: string) => {
        let idToCancel = idOverride || confirmedPickupPin?.id;

        // If no ID found, check in Redux for student's own active pickup
        // This ensures the "Cancel Request" button always finds the right pin
        if (!idToCancel) {
            const myPickup = activePickups.find((p: any) => p.studentId === user?.student?.id || p.student?.id === user?.student?.id);
            if (myPickup) idToCancel = myPickup.id || myPickup.pickupId;
        }

        if (!idToCancel) return;

        Alert.alert(
            'Cancel Pickup',
            'Do you want to cancel your pickup request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: () => {
                        socket?.emit('student:cancel-pin', { pickupId: idToCancel });
                        dispatch(removePickup(idToCancel));
                        if (confirmedPickupPin?.id === idToCancel) {
                            setConfirmedPickupPin(null);
                        }
                    },
                },
            ]
        );
    };

    const handleMapPress = (e: any) => {
        if (isSelectionMode) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setManualPickupLocation({ lat: latitude, lng: longitude });
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
    };

    const handleSelectBus = (bus: any) => {
        setSelectedBusId(bus.busId);
        setSearchQuery('');
        setIsSearching(false);

        // Center map on bus
        if (bus.lat && bus.lng) {
            getActiveMapRef()?.animateToRegion({
                latitude: bus.lat,
                longitude: bus.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 1000);
        }
    };

    const activeBuses = buses; // Show all buses with a location, as requested.

    const filteredBuses = activeBuses.filter(bus =>
        bus.busNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const liveSelectedBus = selectedBusId ? activeBuses.find(b => b.busId === selectedBusId) : null;
    const displayedBuses = (liveSelectedBus && liveSelectedBus.lat != null) ? [liveSelectedBus] : activeBuses;

    const renderMapElements = () => (
        <>
            {/* Student Marker (Live Location) */}
            {myLocation && typeof myLocation.lat === 'number' && (
                <Marker
                    coordinate={{ latitude: myLocation.lat, longitude: myLocation.lng }}
                    title="My Live Location"
                    zIndex={1}
                >
                    <View style={styles.myMarker}>
                        <View style={styles.myMarkerInner} />
                    </View>
                </Marker>
            )}

            {/* Manual Selection Mode Marker */}
            {isSelectionMode && manualPickupLocation && typeof manualPickupLocation.lat === 'number' && (
                <Marker
                    coordinate={{ latitude: manualPickupLocation.lat, longitude: manualPickupLocation.lng }}
                    draggable
                    onDragEnd={(e) => setManualPickupLocation({
                        lat: e.nativeEvent.coordinate.latitude,
                        lng: e.nativeEvent.coordinate.longitude
                    })}
                >
                    <View style={styles.selectionMarker}>
                        <MapPin size={32} color={theme.colors.secondary} fill={theme.colors.secondary + '40'} />
                    </View>
                </Marker>
            )}

            {/* Confirmed Pickup Pin — tappable to cancel (local state, before Redux confirmation) */}
            {confirmedPickupPin && confirmedPickupPin.lat && (
                <Marker
                    coordinate={{
                        latitude: Number(confirmedPickupPin.lat),
                        longitude: Number(confirmedPickupPin.lng),
                    }}
                    onPress={() => handleCancelPickup()}
                    zIndex={10}
                    anchor={{ x: 0.5, y: 1 }}
                >
                    <View style={styles.markerContainer}>
                        <View style={[styles.markerLabel, { borderColor: theme.colors.secondary }]}>
                            <Text style={styles.markerLabelText} numberOfLines={1}>Setting Pickup...</Text>
                        </View>
                        <View style={[styles.markerCircle, { backgroundColor: theme.colors.error, borderColor: theme.colors.secondary, borderWidth: 3 }]}>
                            <User size={18} color="white" />
                        </View>
                        <View style={[styles.markerTail, { borderTopColor: theme.colors.error }]} />
                    </View>
                </Marker>
            )}

            {/* Socket-confirmed pickups from Redux */}
            {activePickups.map((pickup: any) => {
                const lat = Number(pickup.lat || pickup.location?.lat);
                const lng = Number(pickup.lng || pickup.location?.lng);
                if (isNaN(lat) || isNaN(lng)) return null;

                const pickupId = pickup.id || pickup.pickupId;
                const isMyPickup = pickup.studentId === user?.student?.id || pickup.student?.id === user?.student?.id;
                const isPaid = (pickup.feeStatus === 'PAID' || pickup.student?.feeStatus === 'PAID');
                const circleColor = isPaid ? theme.colors.error : '#64748b';

                return (
                    <Marker
                        key={`active-pickup-${pickupId}`}
                        coordinate={{ latitude: lat, longitude: lng }}
                        onPress={() => handleCancelPickup(pickupId)}
                        zIndex={isMyPickup ? 8 : 4}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.markerContainer}>
                            <View style={[styles.markerLabel, isMyPickup && { borderColor: theme.colors.secondary }]}>
                                <Text style={styles.markerLabelText} numberOfLines={1}>
                                    {pickup.student?.name || 'Student'}{isMyPickup ? ' (Me)' : ''}
                                </Text>
                            </View>
                            <View style={[styles.markerCircle, { backgroundColor: circleColor }, isMyPickup && { borderColor: theme.colors.secondary, borderWidth: 3 }]}>
                                <User size={16} color="white" />
                            </View>
                            <View style={[styles.markerTail, { borderTopColor: circleColor }]} />
                        </View>
                    </Marker>
                );
            })}

            {/* Bus Markers — tap to select */}
            {displayedBuses.map((bus: any) => {
                const bLat = Number(bus.lat);
                const bLng = Number(bus.lng);

                if (isNaN(bLat) || isNaN(bLng) || bus.lat == null) return null;
                const isSelected = selectedBusId === bus.busId;

                // Use server-provided isLive if available; otherwise fallback to 30s threshold
                const timestamp = bus.lastUpdate || bus.lastLocationUpdate;
                const isLive = bus.isLive !== undefined
                    ? bus.isLive
                    : (timestamp && (Date.now() - new Date(timestamp).getTime() < 30 * 1000));

                const busColor = isSelected ? theme.colors.secondary : isLive ? theme.colors.primary : '#94a3b8';

                return (
                    <Marker
                        key={`bus-${bus.busId}`}
                        coordinate={{ latitude: bLat, longitude: bLng }}
                        onPress={() => handleSelectBus(bus)}
                        zIndex={isSelected ? 10 : 5}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={[styles.markerContainer, isSelected && { transform: [{ scale: 1.1 }] }]}>
                            <View style={[styles.markerLabel, isSelected && { borderColor: theme.colors.secondary }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {isLive && <View style={styles.liveDot} />}
                                    <Text style={styles.markerLabelText} numberOfLines={1}>Bus {bus.busNumber}</Text>
                                </View>
                            </View>
                            <View style={[styles.markerCircle, { backgroundColor: busColor }]}>
                                <Bus size={18} color="white" />
                            </View>
                            <View style={[styles.markerTail, { borderTopColor: busColor }]} />
                        </View>
                    </Marker>
                );
            })}
        </>
    );

    const renderSearchResults = () => {
        if (!isSearching || searchQuery.length === 0) return null;
        return (
            <View style={styles.resultsCard}>
                {filteredBuses.map((bus: any, index: number) => (
                    <TouchableOpacity
                        key={bus.busId || `search-${index}`}
                        style={styles.resultItem}
                        onPress={() => handleSelectBus(bus)}
                    >
                        <Navigation size={18} color={theme.colors.primary} />
                        <View style={styles.resultDetails}>
                            <Text style={styles.resultBusNumber}>Bus {bus.busNumber}</Text>
                            <Text style={styles.resultRoute}>{bus.routeName}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
                {filteredBuses.length === 0 && (
                    <Text style={styles.noResults}>No buses found</Text>
                )}
            </View>
        );
    };

    return (
        <ImageBackground source={BG_IMAGE} style={styles.background} resizeMode="cover">
            <View style={styles.overlay} />

            {/* ============== MAIN SCREEN ============== */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => setIsMenuOpen(true)} style={{ marginRight: 15 }}>
                            <Menu size={28} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.greeting}>Welcome 👋</Text>
                            <Text style={styles.userName}>{user?.student?.fullName || 'Student'}</Text>
                        </View>
                    </View>
                    <View style={styles.busCountBadge}>
                        <Text style={styles.busCountText}>{activeBuses.length} Buses Live</Text>
                    </View>
                </View>

                {/* Dummy Search bar to open modal */}
                <TouchableOpacity
                    style={styles.searchBar}
                    activeOpacity={0.9}
                    onPress={() => {
                        setIsFullScreenMap(true);
                        setIsSearching(true);
                    }}
                >
                    <Search size={18} color={theme.colors.textLight} />
                    <Text style={[styles.searchInput, { color: theme.colors.textLight }]}>
                        {liveSelectedBus ? `Bus ${liveSelectedBus.busNumber} Selected` : "Search bus number..."}
                    </Text>
                </TouchableOpacity>

                {/* Selected bus banner on Main Screen */}
                {liveSelectedBus && (
                    <View style={[styles.selectedBusCard, { marginTop: 15 }]}>
                        <Navigation size={18} color={theme.colors.primary} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.selectedBusTitle}>Bus {liveSelectedBus.busNumber} selected</Text>
                            <Text style={styles.selectedBusRoute}>{liveSelectedBus.routeName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedBusId(null)}>
                            <X size={18} color={theme.colors.textLight} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Map slightly below */}
                <View style={{ marginTop: 40 }}>
                    <Text style={styles.sectionTitle}>Live Bus Map</Text>
                    <View style={[styles.mapBoxContainer, { height: 260 }]}>
                        <MapView
                            ref={smallMapRef}
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            initialRegion={{
                                latitude: (confirmedPickupPin?.lat || myLocation?.lat || 32.7059),
                                longitude: (confirmedPickupPin?.lng || myLocation?.lng || 74.8651),
                                latitudeDelta: 0.02,
                                longitudeDelta: 0.02,
                            }}
                            scrollEnabled={false} // Make it just a preview
                            zoomEnabled={false}
                        >
                            {renderMapElements()}
                        </MapView>

                        <TouchableOpacity
                            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]}
                            activeOpacity={1}
                            onPress={() => setIsFullScreenMap(true)}
                        />
                    </View>

                    {/* Pickup Status Banner below small map */}
                    {activePickups.some(p => p.studentId === user?.student?.id || p.student?.id === user?.student?.id) && (
                        <View style={[
                            styles.pickupStatusBanner,
                            isDriverNearby ? styles.bannerSuccess : styles.bannerInfo
                        ]}>
                            <View style={styles.bannerRow}>
                                <Clock size={20} color="white" />
                                <Text style={styles.bannerText}>
                                    {isDriverNearby
                                        ? "Driver reached your marked location!"
                                        : "Waiting for the driver..."}
                                </Text>
                            </View>
                            {!isDriverNearby && (
                                <Text style={styles.bannerSubText}>Your pickup request is active. A driver will be with you shortly.</Text>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Floating Pick Me Up Button (Bottom Right) */}
            <TouchableOpacity
                style={styles.fabPickBtn}
                onPress={() => setIsFullScreenMap(true)}
                activeOpacity={0.9}
            >
                <MapPin size={24} color="white" />
                <Text style={styles.fabPickText}>Pick Me Up</Text>
            </TouchableOpacity>


            {/* ============== FULL SCREEN MAP MODAL ============== */}
            <Modal
                visible={isFullScreenMap}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsFullScreenMap(false)}
            >
                <View style={styles.fullScreenModalContainer}>
                    {/* Top Header & Search inside Modal */}
                    <View style={styles.fullScreenTopBar}>
                        <TouchableOpacity
                            onPress={() => {
                                setIsFullScreenMap(false);
                                setIsSelectionMode(false);
                            }}
                            style={styles.backBtn}
                        >
                            <ArrowLeft size={24} color={theme.colors.text} />
                        </TouchableOpacity>

                        <View style={[styles.searchBar, { flex: 1, paddingVertical: 8, ...theme.shadows.none }]}>
                            <Search size={18} color={theme.colors.textLight} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search bus number..."
                                placeholderTextColor={theme.colors.textLight}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                onFocus={() => setIsSearching(true)}
                            />
                            {isSearching && searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
                                    <X size={18} color={theme.colors.textLight} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Results overlay */}
                    {isSearching && searchQuery.length > 0 && (
                        <View style={styles.fullScreenResultsOverlay}>
                            {renderSearchResults()}
                        </View>
                    )}

                    {/* Map */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        {isSelectionMode && (
                            <View style={styles.selectionBanner}>
                                <Text style={styles.selectionBannerText}>📍 Tap on map to set your pickup location</Text>
                            </View>
                        )}

                        <MapView
                            ref={fullMapRef}
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            onPress={handleMapPress}
                            initialRegion={{
                                latitude: myLocation?.lat || 32.7059,
                                longitude: myLocation?.lng || 74.8651,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                        >
                            {renderMapElements()}
                        </MapView>

                        <TouchableOpacity
                            style={styles.recenterBtn}
                            onPress={() => {
                                if (myLocation) {
                                    fullMapRef.current?.animateToRegion({
                                        latitude: myLocation.lat,
                                        longitude: myLocation.lng,
                                        latitudeDelta: 0.01,
                                        longitudeDelta: 0.01,
                                    }, 800);
                                }
                            }}
                        >
                            <Navigation size={18} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Actions Row */}
                    <View style={styles.fullScreenBottomPanel}>
                        {liveSelectedBus && !isSelectionMode && (
                            <View style={[styles.selectedBusCard, { marginTop: 0, marginBottom: 15 }]}>
                                <Navigation size={18} color={theme.colors.primary} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.selectedBusTitle}>Bus {liveSelectedBus.busNumber} selected</Text>
                                    <Text style={styles.selectedBusRoute}>{liveSelectedBus.routeName}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedBusId(null)}>
                                    <X size={18} color={theme.colors.textLight} />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={[
                                    styles.pickBtn,
                                    (!liveSelectedBus || confirmedPickupPin || activePickups.some(p => p.studentId === user?.student?.id)) && styles.pickBtnDisabled,
                                    isSelectionMode && styles.pickBtnConfirm,
                                ]}
                                onPress={handlePickMeUp}
                                activeOpacity={0.85}
                                disabled={!!(activePickups.some(p => p.studentId === user?.student?.id || p.student?.id === user?.student?.id) || confirmedPickupPin)}
                            >
                                <MapPin size={20} color="white" />
                                <Text style={styles.pickBtnText}>
                                    {activePickups.some(p => p.studentId === user?.student?.id || p.student?.id === user?.student?.id) || confirmedPickupPin
                                        ? 'Pickup in Progress'
                                        : !liveSelectedBus
                                            ? 'Select a Bus First'
                                            : isSelectionMode
                                                ? 'Confirm Pickup Location ✓'
                                                : `Set Pickup Location for Bus ${liveSelectedBus.busNumber}`}
                                </Text>
                            </TouchableOpacity>

                            {isSelectionMode && (
                                <TouchableOpacity
                                    style={styles.cancelSelectionBtn}
                                    onPress={() => {
                                        setIsSelectionMode(false);
                                        setManualPickupLocation(null);
                                    }}
                                >
                                    <Text style={styles.cancelSelectionText}>Cancel Setup</Text>
                                </TouchableOpacity>
                            )}

                            {confirmedPickupPin && (
                                <View style={styles.activePickupCard}>
                                    <View style={styles.activePickupHeader}>
                                        <View style={styles.pulseDotContainer}>
                                            <View style={styles.pulseDotInner} />
                                        </View>
                                        <View>
                                            <Text style={styles.activePickupTitle}>Waiting for Driver</Text>
                                            <Text style={styles.activePickupSub}>Stay near the pinned location</Text>
                                        </View>
                                    </View>
                                    <View style={styles.activePickupActions}>
                                        <View style={styles.timeEst}>
                                            <Clock size={16} color={theme.colors.textLight} />
                                            <Text style={styles.timeEstText}>On the way...</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.cancelPickupBtn}
                                            onPress={() => handleCancelPickup()}
                                        >
                                            <X size={16} color={theme.colors.error} />
                                            <Text style={styles.cancelPickupText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ============== DRAWER MENU MODAL ============== */}
            <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
                <View style={styles.drawerOverlay}>
                    <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} activeOpacity={1} />
                    <View style={styles.drawerContainer}>
                        <View style={styles.drawerHeader}>
                            <User size={36} color="white" />
                            <Text style={styles.drawerStudentName}>{user?.student?.fullName}</Text>
                            <Text style={styles.drawerStudentEmail}>{user?.email}</Text>
                        </View>
                        <View style={{ paddingTop: 20 }}>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => { setIsMenuOpen(false); setIsProfileOpen(true); }}>
                                <User size={22} color={theme.colors.text} />
                                <Text style={styles.drawerItemText}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => { setIsMenuOpen(false); setIsSettingsOpen(true); }}>
                                <SettingsIcon size={22} color={theme.colors.text} />
                                <Text style={styles.drawerItemText}>Settings</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={[styles.drawerItem, { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 25, marginBottom: 30 }]} onPress={() => { setIsMenuOpen(false); dispatch(logout()); }}>
                            <LogOut size={22} color={theme.colors.error} />
                            <Text style={[styles.drawerItemText, { color: theme.colors.error }]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============== PROFILE MODAL ============== */}
            <Modal visible={isProfileOpen} transparent animationType="slide" onRequestClose={() => setIsProfileOpen(false)}>
                <View style={styles.centeredModalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsProfileOpen(false)} />
                    <View style={styles.profileModalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>My Profile</Text>
                            <TouchableOpacity onPress={() => setIsProfileOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Name</Text>
                            <Text style={styles.profileValue}>{user?.student?.fullName}</Text>
                        </View>
                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Roll No.</Text>
                            <Text style={styles.profileValue}>{user?.student?.rollNumber}</Text>
                        </View>
                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Semester</Text>
                            <Text style={styles.profileValue}>{user?.student?.semester}</Text>
                        </View>
                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Department</Text>
                            <Text style={styles.profileValue}>{user?.student?.department}</Text>
                        </View>
                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Fee Status</Text>
                            <View style={[styles.feeBadge, user?.student?.feeStatus === 'PAID' ? styles.feePaid : styles.feeDue]}>
                                <Text style={styles.feeBadgeText}>{user?.student?.feeStatus}</Text>
                            </View>
                        </View>
                        <View style={styles.profileDetailRow}>
                            <Text style={styles.profileLabel}>Email</Text>
                            <Text style={styles.profileValue}>{user?.email}</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ============== SETTINGS MODAL ============== */}
            <Modal visible={isSettingsOpen} transparent animationType="slide" onRequestClose={() => setIsSettingsOpen(false)}>
                <View style={styles.centeredModalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsSettingsOpen(false)} />
                    <View style={styles.profileModalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.settingsOptionBtn} onPress={() => { setIsSettingsOpen(false); setIsChangePasswordOpen(true); }}>
                            <Lock size={20} color={theme.colors.text} />
                            <Text style={styles.settingsOptionText}>Change Password</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingsOptionBtn} onPress={() => { setIsSettingsOpen(false); setIsReportIssueOpen(true); }}>
                            <MessageSquare size={20} color={theme.colors.text} />
                            <Text style={styles.settingsOptionText}>Report an Issue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============== CHANGE PASSWORD MODAL ============== */}
            <Modal visible={isChangePasswordOpen} transparent animationType="fade" onRequestClose={() => setIsChangePasswordOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centeredModalOverlay}>
                    <View style={styles.profileModalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <TouchableOpacity onPress={() => setIsChangePasswordOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.formInput}
                            placeholder="Current Password"
                            secureTextEntry
                            value={oldPassword}
                            onChangeText={setOldPassword}
                        />
                        <TextInput
                            style={styles.formInput}
                            placeholder="New Password"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <TouchableOpacity style={styles.submitBtn} onPress={handleChangePassword}>
                            <Text style={styles.submitBtnText}>Update Password</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ============== REPORT ISSUE MODAL ============== */}
            <Modal visible={isReportIssueOpen} transparent animationType="fade" onRequestClose={() => setIsReportIssueOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centeredModalOverlay}>
                    <View style={styles.profileModalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Report an Issue</Text>
                            <TouchableOpacity onPress={() => setIsReportIssueOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.formNote}>Please describe the problem below. Our admin team will look into it.</Text>
                        <TextInput
                            style={[styles.formInput, { height: 120, textAlignVertical: 'top' }]}
                            placeholder="Describe your issue here..."
                            multiline
                            numberOfLines={5}
                            value={issueText}
                            onChangeText={setIssueText}
                        />
                        <TouchableOpacity style={styles.submitBtn} onPress={handleReportIssue}>
                            <Text style={styles.submitBtnText}>Submit Report</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        width,
        height,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 56,
        paddingHorizontal: 18,
        paddingBottom: 100, // padding for Fab
    },

    /* Header */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    userName: {
        fontSize: 22,
        fontWeight: '800',
        color: 'white',
    },
    busCountBadge: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    busCountText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 13,
    },

    /* Search Bar Shared */
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        ...theme.shadows.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: theme.colors.text,
    },

    /* Selected bus chip */
    selectedBusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        ...theme.shadows.sm,
    },
    selectedBusTitle: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
    selectedBusRoute: { fontSize: 12, color: theme.colors.textLight },

    /* Small Map Box */
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
        marginBottom: 10,
    },
    mapBoxContainer: {
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: '#e0e0e0',
        ...theme.shadows.lg,
    },
    map: {
        flex: 1,
    },

    /* Floating Pick Me Up Button */
    fabPickBtn: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30,
        ...theme.shadows.lg,
        elevation: 6,
    },
    fabPickText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
        marginLeft: 8,
    },

    /* ===== Full Screen Modal Styles ===== */
    fullScreenModalContainer: {
        flex: 1,
        backgroundColor: '#f9f9f9',
    },
    fullScreenTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        paddingHorizontal: 15,
        paddingBottom: 15,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        zIndex: 10,
    },
    backBtn: {
        padding: 8,
        marginRight: 8,
    },
    fullScreenResultsOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 110 : 100,
        left: 15,
        right: 15,
        zIndex: 20,
    },
    resultsCard: {
        backgroundColor: 'white',
        borderRadius: 14,
        padding: 8,
        ...theme.shadows.lg,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    resultDetails: { marginLeft: 12 },
    resultBusNumber: { fontWeight: '700', color: theme.colors.text, fontSize: 15 },
    resultRoute: { fontSize: 12, color: theme.colors.textLight },
    noResults: { padding: 16, textAlign: 'center', color: theme.colors.textLight },

    fullScreenBottomPanel: {
        backgroundColor: 'white',
        paddingTop: 15,
        paddingBottom: Platform.OS === 'ios' ? 35 : 20,
        paddingHorizontal: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...theme.shadows.lg,
        shadowOffset: { width: 0, height: -4 },
    },

    /* Map Elements (Selection banner, recenter) */
    selectionBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: 'rgba(16,185,129,0.9)',
        paddingVertical: 8,
        alignItems: 'center',
    },
    selectionBannerText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    recenterBtn: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'white',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.md,
    },

    /* Markers */

    selectionMarker: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    busMarker: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
        ...theme.shadows.sm,
    },
    targetMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmedMarker: {
        backgroundColor: theme.colors.primary,
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'white',
        ...theme.shadows.sm,
    },
    /* === Unified Map Marker System === */
    /* IMPORTANT: NO elevation/shadow inside markers — Android clips view bounds when
       elevation is used inside a MapView Marker, hiding the label and circle. */
    markerContainer: {
        width: 120,
        height: 95,
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
    },
    markerLabel: {
        backgroundColor: 'white',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 4,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',  // visible border instead of shadow
        // NO elevation / shadow — causes Android MapView clipping
    },
    markerLabelText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
    },
    markerCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 3,
        borderColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        // NO elevation / shadow — causes Android MapView clipping
    },
    markerTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 11,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        // borderTopColor is set inline per marker
    },

    /* Student 'My Location' dot */
    myMarker: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(37,99,235,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    myMarkerInner: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#2563eb',
        borderWidth: 2.5,
        borderColor: 'white',
        // NO elevation / shadow
    },

    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10b981',
        marginRight: 4,
    },

    /* Action buttons (in Full Screen) */
    actionsRow: {
        gap: 12,
    },
    pickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: 18,
        borderRadius: 14,
        ...theme.shadows.sm,
        gap: 10,
    },
    pickBtnDisabled: {
        backgroundColor: theme.colors.textLight,
    },
    pickBtnConfirm: {
        backgroundColor: theme.colors.primaryDark,
    },
    pickBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.3,
    },
    cancelSelectionBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cancelSelectionText: {
        color: theme.colors.textLight,
        fontWeight: '600',
        fontSize: 15,
    },
    activePickupCard: {
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)',
    },
    activePickupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    pulseDotContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16,185,129,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    pulseDotInner: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: theme.colors.primary,
    },
    activePickupTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    activePickupSub: {
        fontSize: 13,
        color: theme.colors.textLight,
        marginTop: 2,
    },
    activePickupActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(16,185,129,0.2)',
        paddingTop: 12,
    },
    timeEst: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeEstText: {
        marginLeft: 6,
        color: theme.colors.textLight,
        fontSize: 14,
        fontWeight: '600',
    },
    cancelPickupBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 10,
    },
    cancelPickupText: {
        color: theme.colors.error,
        fontWeight: '700',
        fontSize: 14,
    },

    /* Drawer Styles */
    drawerOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    drawerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawerContainer: {
        width: width * 0.75,
        backgroundColor: 'white',
        height: '100%',
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        ...theme.shadows.lg,
    },
    drawerHeader: {
        backgroundColor: theme.colors.primary,
        padding: 20,
        paddingTop: 30,
        paddingBottom: 30,
        alignItems: 'center',
    },
    drawerStudentName: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
    },
    drawerStudentEmail: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginTop: 4,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 25,
    },
    drawerItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 15,
    },

    /* Centered Modals (Profile, Settings, Report) */
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    profileModalBox: {
        backgroundColor: 'white',
        width: '100%',
        borderRadius: 20,
        padding: 20,
        ...theme.shadows.lg,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },

    /* Profile Details */
    profileDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    profileLabel: {
        fontSize: 15,
        color: theme.colors.textLight,
        fontWeight: '500',
    },
    profileValue: {
        fontSize: 15,
        color: theme.colors.text,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'right',
        maxWidth: '65%',
    },
    feeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    feePaid: { backgroundColor: 'rgba(16,185,129,0.15)' },
    feeDue: { backgroundColor: 'rgba(239,68,68,0.15)' },
    feeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.text,
    },

    /* Settings & Forms */
    settingsOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    settingsOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 15,
    },
    formNote: {
        fontSize: 14,
        color: theme.colors.textLight,
        marginBottom: 15,
        lineHeight: 20,
    },
    formInput: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.colors.text,
        marginBottom: 15,
    },
    submitBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    submitBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },

    /* Pickup Banner */
    pickupStatusBanner: {
        marginTop: -5,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        padding: 15,
        ...theme.shadows.md,
    },
    bannerInfo: {
        backgroundColor: theme.colors.primary,
    },
    bannerSuccess: {
        backgroundColor: '#2e7d32', // Green
    },
    bannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bannerText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
    },
    bannerSubText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        marginTop: 4,
        marginLeft: 30,
    },
});

export default StudentHomeScreen;
