const axios = require('axios');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Address → { lat, lng, formatted }. Returns null on failure.
// Uses Nominatim (OpenStreetMap) — free, no API key required.
// Policy: max 1 req/sec; must send a descriptive User-Agent.
exports.geocodeAddress = async (address) => {
  if (!address) return null;

  try {
    const { data } = await axios.get(NOMINATIM, {
      params: {
        q: address,
        format: 'json',
        limit: 1,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'ZeroFoodWasteConnect/1.0 (FYP-MinhajUniversity)',
        'Accept-Language': 'en',
      },
      timeout: 6000,
    });

    if (!Array.isArray(data) || !data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon), // Nominatim returns 'lon', normalise to 'lng'
      formatted: data[0].display_name,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[geocode] Nominatim failed:', err.message);
    return null;
  }
};
