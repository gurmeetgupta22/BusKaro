/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lng1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lng2 Longitude of point 2
 * @returns Distance in meters
 */
export const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Calculate bearing between two coordinates
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;

    return bearing;
};

/**
 * Check if a point is within a radius of another point
 */
export const isWithinRadius = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
    radiusMeters: number
): boolean => {
    const distance = calculateDistance(lat1, lng1, lat2, lng2);
    return distance <= radiusMeters;
};

/**
 * Calculate speed between two points
 * @param distance Distance in meters
 * @param timeSeconds Time difference in seconds
 * @returns Speed in km/h
 */
export const calculateSpeed = (distance: number, timeSeconds: number): number => {
    if (timeSeconds === 0) return 0;
    const metersPerSecond = distance / timeSeconds;
    return (metersPerSecond * 3600) / 1000; // Convert to km/h
};

/**
 * Validate GPS coordinates
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/**
 * Detect potential GPS spoofing based on speed
 * @param prevLat Previous latitude
 * @param prevLng Previous longitude
 * @param prevTime Previous timestamp
 * @param currLat Current latitude
 * @param currLng Current longitude
 * @param currTime Current timestamp
 * @param maxSpeedKmh Maximum realistic speed (default 120 km/h)
 * @returns true if location appears spoofed
 */
export const detectLocationSpoof = (
    prevLat: number,
    prevLng: number,
    prevTime: Date,
    currLat: number,
    currLng: number,
    currTime: Date,
    maxSpeedKmh: number = 120
): boolean => {
    // Check if coordinates are valid
    if (!isValidCoordinate(prevLat, prevLng) || !isValidCoordinate(currLat, currLng)) {
        return true;
    }

    // Calculate distance and time difference
    const distance = calculateDistance(prevLat, prevLng, currLat, currLng);
    const timeDiffSeconds = (currTime.getTime() - prevTime.getTime()) / 1000;

    // If time difference is too small, skip check
    if (timeDiffSeconds < 1) {
        return false;
    }

    // Calculate speed
    const speed = calculateSpeed(distance, timeDiffSeconds);

    // Check if speed exceeds maximum realistic speed
    return speed > maxSpeedKmh;
};

/**
 * Cluster nearby pickup points using simple distance-based clustering
 * @param pickups Array of pickup points with lat, lng
 * @param radiusMeters Clustering radius in meters
 * @returns Array of cluster centers
 */
export const clusterPickupPoints = (
    pickups: Array<{ id: string; lat: number; lng: number;[key: string]: any }>,
    radiusMeters: number = 100
): Array<{
    centerLat: number;
    centerLng: number;
    pickupIds: string[];
    count: number;
}> => {
    const clusters: Array<{
        centerLat: number;
        centerLng: number;
        pickupIds: string[];
        count: number;
    }> = [];

    const processed = new Set<string>();

    for (const pickup of pickups) {
        if (processed.has(pickup.id)) continue;

        const cluster = {
            centerLat: pickup.lat,
            centerLng: pickup.lng,
            pickupIds: [pickup.id],
            count: 1,
        };

        processed.add(pickup.id);

        // Find nearby pickups
        for (const otherPickup of pickups) {
            if (processed.has(otherPickup.id)) continue;

            if (
                isWithinRadius(
                    pickup.lat,
                    pickup.lng,
                    otherPickup.lat,
                    otherPickup.lng,
                    radiusMeters
                )
            ) {
                cluster.pickupIds.push(otherPickup.id);
                cluster.count++;
                processed.add(otherPickup.id);

                // Update cluster center (average)
                cluster.centerLat =
                    (cluster.centerLat * (cluster.count - 1) + otherPickup.lat) /
                    cluster.count;
                cluster.centerLng =
                    (cluster.centerLng * (cluster.count - 1) + otherPickup.lng) /
                    cluster.count;
            }
        }

        clusters.push(cluster);
    }

    return clusters;
};

/**
 * Calculate ETA based on distance and average speed
 * @param distanceMeters Distance in meters
 * @param avgSpeedKmh Average speed in km/h
 * @returns ETA in minutes
 */
export const calculateETA = (
    distanceMeters: number,
    avgSpeedKmh: number = 30
): number => {
    const distanceKm = distanceMeters / 1000;
    const timeHours = distanceKm / avgSpeedKmh;
    return Math.ceil(timeHours * 60); // Convert to minutes and round up
};

/**
 * Get the center point of multiple coordinates
 */
export const getCenterPoint = (
    coordinates: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } => {
    if (coordinates.length === 0) {
        throw new Error('No coordinates provided');
    }

    const sumLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const sumLng = coordinates.reduce((sum, coord) => sum + coord.lng, 0);

    return {
        lat: sumLat / coordinates.length,
        lng: sumLng / coordinates.length,
    };
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
};

/**
 * Format duration for display
 */
export const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
};
