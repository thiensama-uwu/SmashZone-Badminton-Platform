/**
 * Geocoding Service using OpenStreetMap Nominatim API
 * Converts address to latitude/longitude and vice versa
 * Free and does not require API key
 */

const { requestJson } = require('./http-client');

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Geocode address to latitude/longitude
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lon: number, display_name: string}>}
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') {
    throw new Error('Address is required and must be a string');
  }

  try {
    const url = `${NOMINATIM_BASE_URL}/search`;
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      limit: '1',
      addressdetails: '1',
    });

    const results = await requestJson('GET', `${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'BadmintonBookingSystem/1.0',
      },
    });

    if (!results || results.length === 0) {
      throw new Error('Address not found');
    }

    const firstResult = results[0];
    return {
      lat: parseFloat(firstResult.lat),
      lon: parseFloat(firstResult.lon),
      display_name: firstResult.display_name,
    };
  } catch (error) {
    throw new Error(`Geocoding failed: ${error.message}`);
  }
}

/**
 * Reverse geocode latitude/longitude to address
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{display_name: string, address: object}>}
 */
async function reverseGeocode(lat, lon) {
  if (!lat || !lon || typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Latitude and longitude are required and must be numbers');
  }

  try {
    const url = `${NOMINATIM_BASE_URL}/reverse`;
    const params = new URLSearchParams({
      format: 'json',
      lat: lat.toString(),
      lon: lon.toString(),
      addressdetails: '1',
    });

    const result = await requestJson('GET', `${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'BadmintonBookingSystem/1.0',
      },
    });

    if (!result || result.error) {
      throw new Error('Location not found');
    }

    return {
      display_name: result.display_name,
      address: result.address,
    };
  } catch (error) {
    throw new Error(`Reverse geocoding failed: ${error.message}`);
  }
}

/**
 * Search for addresses with autocomplete
 * @param {string} query - Search query
 * @param {number} limit - Number of results (default: 5)
 * @returns {Promise<Array<{place_id: string, display_name: string, lat: number, lon: number}>>}
 */
async function searchAddress(query, limit = 5) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  try {
    const url = `${NOMINATIM_BASE_URL}/search`;
    const params = new URLSearchParams({
      format: 'json',
      q: query,
      limit: limit.toString(),
      addressdetails: '1',
    });

    const results = await requestJson('GET', `${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'BadmintonBookingSystem/1.0',
      },
    });

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((result) => ({
      place_id: result.place_id,
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      address: result.address,
    }));
  } catch (error) {
    throw new Error(`Address search failed: ${error.message}`);
  }
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  searchAddress,
};
