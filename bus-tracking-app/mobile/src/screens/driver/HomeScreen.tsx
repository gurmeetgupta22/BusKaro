import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    Animated,
    ImageBackground,
    Modal,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSelector, useDispatch } from 'react-redux';
import {
    MapPin,
    Navigation,
    Bell,
    User,
    CheckCircle,
    Clock,
    Menu,
    X,
    Settings as SettingsIcon,
    LogOut,
    Lock,
    MessageSquare,
    ArrowLeft,
    Bus
} from 'lucide-react-native';
import { theme } from '../../theme/theme';
import { RootState, logout, setPickups } from '../../store';
import { io, Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import api from '../../api/client';
import { SOCKET_URL } from '../../config';

const { width, height } = Dimensions.get('window');
const BG_IMAGE = require('../../../assets/images/background.png');

const DriverHomeScreen = () => {
    const dispatch = useDispatch();
    const { activePickups } = useSelector((state: RootState) => state.tracking);
    const { token, user } = useSelector((state: RootState) => state.user);

    const [socket, setSocket] = useState<Socket | null>(null);
    const [driverLocation, setDriverLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [assignedBusId, setAssignedBusId] = useState<string | null>(null);
    const assignedBusIdRef = React.useRef<string | null>(null);

    // UI states
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
    const [isFullScreenMap, setIsFullScreenMap] = useState(false);

    // Form states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [issueText, setIssueText] = useState('');

    const mapRef = useRef<MapView>(null);
    const fullMapRef = useRef<MapView>(null);

    const getActiveMapRef = () => isFullScreenMap ? fullMapRef.current : mapRef.current;

    useEffect(() => {
        let locationSubscription: any;

        const s = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });

        // Step 1: Fetch assigned bus ID from API
        const initDriver = async () => {
            try {
                const response = await api.get('/drivers/profile');
                // Response shape: { success: true, data: { id, assignedBusId, assignedBus: { ... }, ... } }
                const driverData = response.data?.data;
                const busId = driverData?.assignedBusId || driverData?.assignedBus?.id || null;
                assignedBusIdRef.current = busId;
                setAssignedBusId(busId);

                if (!busId) {
                    Alert.alert('No Bus Assigned', 'You have not been assigned to a bus. Please contact admin.');
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch driver profile:', err);
                // Fallback: try assigned-bus endpoint
                try {
                    const busResp = await api.get('/drivers/assigned-bus');
                    const busId = busResp.data?.data?.id || null;
                    assignedBusIdRef.current = busId;
                    setAssignedBusId(busId);
                    if (!busId) {
                        Alert.alert('No Bus Assigned', 'You have not been assigned to a bus. Please contact admin.');
                        return;
                    }
                } catch (fallbackErr) {
                    console.error('Failed to fetch assigned bus:', fallbackErr);
                    Alert.alert('Error', 'Unable to get your bus assignment. Please try again.');
                    return;
                }
            }

            // Step 2: Get location permission
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to track the bus.');
                return;
            }

            // Step 3: Get initial position and emit
            try {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
                setDriverLocation(coords);

                const payload = { busId: assignedBusIdRef.current, ...coords };
                if (s.connected) s.emit('driver:location-update', payload);

                mapRef.current?.animateToRegion({
                    latitude: coords.lat,
                    longitude: coords.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            } catch (err) {
                console.error('Failed to get initial position:', err);
            }

            // Step 4: Watch position continuously
            locationSubscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, distanceInterval: 10 },
                (loc) => {
                    const newCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
                    setDriverLocation(newCoords);
                    const payload = { busId: assignedBusIdRef.current, ...newCoords };
                    if (s.connected) s.emit('driver:location-update', payload);
                }
            );
        };

        s.on('connect', () => {
            console.log('Driver Connected to Server');
            s.emit('driver:request-pickups');
            // Re-emit latest known location in case socket reconnected
            if (assignedBusIdRef.current && driverLocation) {
                s.emit('driver:location-update', { busId: assignedBusIdRef.current, ...driverLocation });
            }
        });

        s.on('driver:pickups', (data: any) => {
            dispatch(setPickups(data.pickups));
        });

        s.on('pickup:new', (data: any) => {
            s.emit('driver:request-pickups');
            Alert.alert('🚌 New Pickup Request', `${data.student?.name || 'A student'} requested a pickup!`);
        });

        s.on('pickup:cancelled', () => { s.emit('driver:request-pickups'); });
        s.on('pickup:completed', () => { s.emit('driver:request-pickups'); });
        s.on('pickup:picked', () => { s.emit('driver:request-pickups'); });

        setSocket(s);
        initDriver();

        return () => {
            if (s) s.disconnect();
            if (locationSubscription) locationSubscription.remove();
        };
    }, []);

    const handleCompletePickup = (pickupId: string) => {
        if (socket) {
            socket.emit('driver:pickup-complete', { pickupId });
            const newPickups = activePickups.filter((p: any) => p.id !== pickupId);
            dispatch(setPickups(newPickups));
        }
    };

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
            await api.post('/students/report-issue', { issue: issueText }); // Using existing report endpoint
            Alert.alert('Success', 'Issue reported to admin.');
            setIsReportIssueOpen(false);
            setIssueText('');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.message || 'Failed to report issue');
        }
    };

    const renderMarkers = () => (
        <>
            {/* Driver's Bus Marker (Live) */}
            {driverLocation && (
                <Marker
                    coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
                    zIndex={15}
                    anchor={{ x: 0.5, y: 1 }}
                >
                    <View style={styles.markerContainer}>
                        <View style={[styles.markerLabel, { borderColor: theme.colors.secondary }]}>
                            <Text style={styles.markerLabelText} numberOfLines={1}>My Bus</Text>
                        </View>
                        <View style={[styles.markerCircle, { backgroundColor: theme.colors.secondary }]}>
                            <Bus size={20} color="white" />
                        </View>
                        <View style={[styles.markerTail, { borderTopColor: theme.colors.secondary }]} />
                    </View>
                </Marker>
            )}

            {activePickups.map((pickup: any) => {
                const pLat = Number(pickup.lat);
                const pLng = Number(pickup.lng);

                if (isNaN(pLat) || isNaN(pLng)) return null;
                const isPaid = (pickup.feeStatus === 'PAID' || pickup.student?.feeStatus === 'PAID');
                const circleColor = isPaid ? theme.colors.error : '#64748b';

                return (
                    <Marker
                        key={pickup.id}
                        coordinate={{ latitude: pLat, longitude: pLng }}
                        anchor={{ x: 0.5, y: 1 }}
                        onPress={() => handleCompletePickup(pickup.id)}
                        zIndex={10}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerLabel}>
                                <Text style={styles.markerLabelText} numberOfLines={1}>
                                    {pickup.student?.name || 'Student'}
                                </Text>
                                {pickup.student?.rollNumber && (
                                    <Text style={[styles.markerLabelText, { fontSize: 9, opacity: 0.7 }]} numberOfLines={1}>
                                        {pickup.student.rollNumber}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.markerCircle, { backgroundColor: circleColor }]}>
                                <User size={17} color="white" />
                            </View>
                            <View style={[styles.markerTail, { borderTopColor: circleColor }]} />
                        </View>
                    </Marker>
                );
            })}
        </>
    );

    return (
        <ImageBackground source={BG_IMAGE} style={styles.container}>
            <View style={styles.overlay} />

            {/* Header Area */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => setIsMenuOpen(true)}>
                        <Menu size={28} color="white" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleGroup}>
                        <Text style={styles.greeting}>Hello,</Text>
                        <Text style={styles.userName}>{user?.driver?.fullName || 'Driver'}</Text>
                    </View>
                </View>

                {/* Stats Card */}
                <TouchableOpacity
                    style={styles.statsCard}
                    onPress={() => setIsFullScreenMap(true)}
                    activeOpacity={0.9}
                >
                    <View style={styles.statsInfo}>
                        <Bell size={24} color={theme.colors.primary} />
                        <View style={{ marginLeft: 15 }}>
                            <Text style={styles.statsCount}>{activePickups.length} Pickups Requested</Text>
                            <Text style={styles.statsSub}>Tap to view on map</Text>
                        </View>
                    </View>
                    <ArrowLeft size={20} color={theme.colors.primary} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
            </View>

            {/* Preview Map Section */}
            <View style={styles.previewContainer}>
                <Text style={styles.sectionTitle}>Route Overview</Text>
                <View style={styles.mapBoxWrapper}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={{
                            latitude: driverLocation?.lat || 32.7059,
                            longitude: driverLocation?.lng || 74.8651,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                    >
                        {renderMarkers()}
                    </MapView>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        onPress={() => setIsFullScreenMap(true)}
                    />
                </View>
            </View>

            {/* Pickup List Preview */}
            <View style={styles.listContainer}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {activePickups.map((pickup: any) => (
                        <View key={pickup.id} style={styles.pickupCard}>
                            <View style={styles.cardInfo}>
                                <View style={styles.avatar}>
                                    <User size={20} color={theme.colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.studentName}>{pickup.student?.name}</Text>
                                    <Text style={styles.cardSubText}>{pickup.student?.rollNumber}</Text>
                                </View>
                                <View style={[styles.feeStatus, pickup.feeStatus === 'PAID' ? styles.feePaid : styles.feeDue]}>
                                    <Text style={styles.feeText}>{pickup.feeStatus}</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.completeBtn}
                                onPress={() => handleCompletePickup(pickup.id)}
                            >
                                <CheckCircle size={18} color="white" />
                                <Text style={styles.completeBtnText}>Mark as Picked Up</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                    {activePickups.length === 0 && (
                        <View style={styles.emptyState}>
                            <Clock size={40} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.emptyText}>No active pickup requests</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* ============== DRAWER MENU ============== */}
            <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
                <View style={styles.drawerOverlay}>
                    <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} activeOpacity={1} />
                    <View style={styles.drawerContainer}>
                        <View style={styles.drawerHeader}>
                            <View style={styles.drawerAvatar}>
                                <User size={40} color="white" />
                            </View>
                            <Text style={styles.drawerName}>{user?.driver?.fullName}</Text>
                            <Text style={styles.drawerSub}>Driver • Bus {user?.driver?.assignedBusId || '--'}</Text>
                        </View>
                        <View style={styles.drawerItems}>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => { setIsMenuOpen(false); setIsProfileOpen(true); }}>
                                <User size={22} color={theme.colors.text} />
                                <Text style={styles.drawerItemText}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => { setIsMenuOpen(false); setIsSettingsOpen(true); }}>
                                <SettingsIcon size={22} color={theme.colors.text} />
                                <Text style={styles.drawerItemText}>Settings</Text>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={() => { setIsMenuOpen(false); dispatch(logout()); }}>
                                <LogOut size={22} color={theme.colors.error} />
                                <Text style={[styles.drawerItemText, { color: theme.colors.error }]}>Log Out</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ============== FULL SCREEN MAP ============== */}
            <Modal visible={isFullScreenMap} animationType="slide" onRequestClose={() => setIsFullScreenMap(false)}>
                <View style={{ flex: 1 }}>
                    <MapView
                        ref={fullMapRef}
                        provider={PROVIDER_GOOGLE}
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: driverLocation?.lat || 32.7059,
                            longitude: driverLocation?.lng || 74.8651,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                    >
                        {renderMarkers()}
                    </MapView>
                    <TouchableOpacity style={styles.mapBackBtn} onPress={() => setIsFullScreenMap(false)}>
                        <ArrowLeft size={24} color={theme.colors.text} />
                    </TouchableOpacity>

                    {/* Floating Info */}
                    <View style={styles.mapInfoBox}>
                        <Text style={styles.mapInfoTitle}>{activePickups.length} Active Pickups</Text>
                        <Text style={styles.mapInfoSub}>Red markers = Paid | Grey markers = Due/Overdue</Text>
                    </View>
                </View>
            </Modal>

            {/* ============== PROFILE MODAL ============== */}
            <Modal visible={isProfileOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Driver Profile</Text>
                            <TouchableOpacity onPress={() => setIsProfileOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.profileBox}>
                            <View style={styles.detailRow}>
                                <Text style={styles.label}>Full Name</Text>
                                <Text style={styles.value}>{user?.driver?.fullName}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.label}>License Number</Text>
                                <Text style={styles.value}>{user?.driver?.licenseNumber}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.label}>Assigned Bus</Text>
                                <Text style={styles.value}>
                                    {user?.driver?.assignedBus ? `Bus ${user?.driver?.assignedBus?.busNumber}` : 'Not Assigned'}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.label}>Email ID</Text>
                                <Text style={styles.value}>{user?.email}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ============== SETTINGS MODAL ============== */}
            <Modal visible={isSettingsOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.settingBtn} onPress={() => { setIsSettingsOpen(false); setIsChangePasswordOpen(true); }}>
                            <Lock size={20} color={theme.colors.text} />
                            <Text style={styles.settingText}>Change Password</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingBtn} onPress={() => { setIsSettingsOpen(false); setIsReportIssueOpen(true); }}>
                            <MessageSquare size={20} color={theme.colors.text} />
                            <Text style={styles.settingText}>Report an Issue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============== CHANGE PASSWORD ============== */}
            <Modal visible={isChangePasswordOpen} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <TouchableOpacity onPress={() => setIsChangePasswordOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Current Password"
                            secureTextEntry
                            value={oldPassword}
                            onChangeText={setOldPassword}
                        />
                        <TextInput
                            style={styles.input}
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

            {/* ============== REPORT ISSUE ============== */}
            <Modal visible={isReportIssueOpen} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Report Issue</Text>
                            <TouchableOpacity onPress={() => setIsReportIssueOpen(false)}>
                                <X size={24} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                            placeholder="Describe the issue..."
                            multiline
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
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 25,
        paddingBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    headerTitleGroup: {
        marginLeft: 15,
    },
    greeting: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
    },
    statsCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...theme.shadows.lg,
    },
    statsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsCount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statsSub: {
        fontSize: 12,
        color: theme.colors.textLight,
        marginTop: 2,
    },
    previewContainer: {
        paddingHorizontal: 25,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 15,
    },
    mapBoxWrapper: {
        height: 220,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: '#e2e8f0',
    },
    map: {
        flex: 1,
    },
    listContainer: {
        flex: 1,
        marginTop: 25,
        paddingHorizontal: 25,
    },
    pickupCard: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 15,
        ...theme.shadows.md,
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(16,185,129,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    studentName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    cardSubText: {
        fontSize: 13,
        color: theme.colors.textLight,
        marginTop: 1,
    },
    feeStatus: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    feePaid: { backgroundColor: 'rgba(16,185,129,0.15)' },
    feeDue: { backgroundColor: 'rgba(100,116,139,0.15)' },
    feeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    completeBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    completeBtnText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.6)',
        marginTop: 15,
        fontSize: 16,
    },
    /* === Unified Map Marker System (matches Student screen) === */
    /* IMPORTANT: NO elevation/shadow inside markers — Android clips bounds when
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
        borderColor: '#cbd5e1',
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
    },

    drawerOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    drawerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawerContainer: {
        width: width * 0.75,
        backgroundColor: 'white',
        height: '100%',
    },
    drawerHeader: {
        backgroundColor: theme.colors.primary,
        padding: 30,
        paddingTop: 60,
    },
    drawerAvatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    drawerName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    drawerSub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    drawerItems: {
        flex: 1,
        padding: 20,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderRadius: 12,
    },
    drawerItemText: {
        fontSize: 16,
        marginLeft: 15,
        color: theme.colors.text,
        fontWeight: '600',
    },
    logoutItem: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: 20,
    },
    /* Modal Commons */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 25,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        ...theme.shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    profileBox: {
        marginTop: 10,
    },
    detailRow: {
        marginBottom: 18,
    },
    label: {
        fontSize: 12,
        color: theme.colors.textLight,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        color: theme.colors.text,
        fontWeight: '600',
    },
    settingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    settingText: {
        fontSize: 16,
        marginLeft: 15,
        color: theme.colors.text,
    },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    submitBtn: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    submitBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    /* Full Map UI */
    mapBackBtn: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 15,
        ...theme.shadows.md,
    },
    mapInfoBox: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 20,
        borderRadius: 20,
    },
    mapInfoTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    mapInfoSub: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
    }
});

export default DriverHomeScreen;
