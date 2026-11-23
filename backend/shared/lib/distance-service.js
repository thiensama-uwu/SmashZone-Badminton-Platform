/**
 * Distance Calculation Service
 * Uses Haversine formula to calculate distance between two coordinates
 * Earth radius: 6,371 km
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    throw new Error('All coordinates are required');
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees to convert
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance with multiple points and return sorted by distance
 * @param {Object} origin - Origin coordinates {lat, lon}
 * @param {Array<Object>} destinations - Array of destination coordinates [{lat, lon, id, ...}]
 * @returns {Array<Object>} Array with distance added to each destination, sorted by distance
 */
function calculateDistancesFromOrigin(origin, destinations) {
  if (!origin || !origin.lat || !origin.lon) {
    throw new Error('Origin coordinates are required');
  }

  if (!Array.isArray(destinations) || destinations.length === 0) {
    return [];
  }

  return destinations
    .map((dest) => ({
      ...dest,
      distance: calculateDistance(origin.lat, origin.lon, dest.lat, dest.lon),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Format distance for display
 * @param {number} distanceInKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
function formatDistance(distanceInKm) {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
  return `${distanceInKm.toFixed(1)} km`;
}

/**
 * Estimate travel time by car (average speed: 40 km/h in city)
 * @param {number} distanceInKm - Distance in kilometers
 * @returns {number} Estimated time in minutes
 */
function estimateTravelTime(distanceInKm) {
  const averageSpeed = 40; // km/h in urban areas
  const timeInHours = distanceInKm / averageSpeed;
  return Math.round(timeInHours * 60); // Convert to minutes
}

/**
 * Format travel time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
function formatTravelTime(minutes) {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}p` : `${hours}h`;
}

module.exports = {
  calculateDistance,
  calculateDistancesFromOrigin,
  formatDistance,
  estimateTravelTime,
  formatTravelTime,
};
